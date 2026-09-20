import type { VMStatus } from '../types/editor';
import { compileC, executeWasmBinary, terminateCompilerWorker } from './cCompiler';

export type ConsoleTab = 'compilation' | 'execution';

type OutputListener = (data: string) => void;
type StatusListener = (status: VMStatus, message?: string) => void;

class VMManager {
  public readonly PROMPT = '';
  private status: VMStatus = 'idle';
  private activeTab: ConsoleTab = 'execution';
  private tabListeners: Set<(tab: ConsoleTab) => void> = new Set();
  private compilationListeners: Set<OutputListener> = new Set();
  private executionListeners: Set<OutputListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  private isExecuting: boolean = false;
  private currentWasmController: { sendStdin: (line: string) => void; abort: () => void } | null = null;
  private currentAbortController: { abort: () => void } | null = null;
  private isAwaitingProgramInput: boolean = false;
  private stdinInputBuffer: string = '';

  constructor() {
    this.setStatus('ready', 'Sistema pronto');
  }

  public subscribeActiveTab(listener: (tab: ConsoleTab) => void): () => void {
    this.tabListeners.add(listener);
    listener(this.activeTab);
    return () => this.tabListeners.delete(listener);
  }

  public setActiveTab(tab: ConsoleTab) {
    this.activeTab = tab;
    this.tabListeners.forEach((l) => l(tab));
  }

  public getActiveTab(): ConsoleTab {
    return this.activeTab;
  }

  public subscribeCompilationOutput(listener: OutputListener): () => void {
    this.compilationListeners.add(listener);
    return () => this.compilationListeners.delete(listener);
  }

  public subscribeExecutionOutput(listener: OutputListener): () => void {
    this.executionListeners.add(listener);
    return () => this.executionListeners.delete(listener);
  }

  public subscribeOutput(listener: OutputListener): () => void {
    return this.subscribeExecutionOutput(listener);
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: VMStatus, message?: string) {
    this.status = status;
    this.statusListeners.forEach((l) => l(status, message));
  }

  public emitCompilationOutput(text: string) {
    const normalized = text.replace(/\r?\n/g, '\r\n');
    this.compilationListeners.forEach((l) => l(normalized));
  }

  public emitExecutionOutput(text: string) {
    const normalized = text.replace(/\r?\n/g, '\r\n');
    this.executionListeners.forEach((l) => l(normalized));
  }

  public emitOutput(text: string) {
    this.emitExecutionOutput(text);
  }

  public getStatus(): VMStatus {
    return this.status;
  }

  public syncFile(_filename: string, _content: string) {
    // Compatibilidade reversa
  }

  public clearCompilationTerminal() {
    this.emitCompilationOutput('\x1b[2J\x1b[3J\x1b[H');
  }

  public clearExecutionTerminal() {
    this.stdinInputBuffer = '';
    this.emitExecutionOutput('\x1b[2J\x1b[3J\x1b[H');
  }

  public clearTerminal() {
    this.clearCompilationTerminal();
    this.clearExecutionTerminal();
  }

  public stopExecution() {
    if (!this.isExecuting && !this.isAwaitingProgramInput) return;
    this.emitExecutionOutput('\r\n\x1b[90m[Processo interrompido]\x1b[0m\r\n');
    this.emitCompilationOutput('\r\n\x1b[90m[Processo interrompido]\x1b[0m\r\n');
    terminateCompilerWorker();
    if (this.currentWasmController) {
      try {
        this.currentWasmController.abort();
      } catch {}
      this.currentWasmController = null;
    }
    if (this.currentAbortController) {
      try {
        this.currentAbortController.abort();
      } catch {}
      this.currentAbortController = null;
    }
    this.isExecuting = false;
    this.isAwaitingProgramInput = false;
    this.stdinInputBuffer = '';
    this.setStatus('ready', 'Execução interrompida');
  }

  public async initV86(_alpineUrl?: string) {
    this.setStatus('ready', 'Sistema pronto');
  }

  public sendInput(data: string) {
    // Se o programa em execução estiver aguardando entrada interativa (scanf / cin / getchar)
    if (this.isAwaitingProgramInput) {
      if (data === '\x03') {
        this.stopExecution();
        return;
      }

      // Enter envia linha para o programa
      if (data === '\r' || data === '\n') {
        this.emitExecutionOutput('\r\n');
        const toSend = this.stdinInputBuffer + '\n';
        this.stdinInputBuffer = '';
        this.isAwaitingProgramInput = false;
        if (this.currentWasmController) {
          this.currentWasmController.sendStdin(toSend);
        }
        return;
      }

      // Backspace
      if (data === '\x7f' || data === '\b') {
        if (this.stdinInputBuffer.length > 0) {
          this.stdinInputBuffer = this.stdinInputBuffer.slice(0, -1);
          this.emitExecutionOutput('\b \b');
        }
        return;
      }

      // Colagem com múltiplas linhas
      if (data.includes('\r') || data.includes('\n')) {
        const full = this.stdinInputBuffer + data.replace(/\r\n|\r/g, '\n');
        const lines = full.split('\n');
        const remaining = lines.pop() || '';
        for (const line of lines) {
          this.emitExecutionOutput(line + '\r\n');
          this.currentWasmController?.sendStdin(line + '\n');
        }
        this.stdinInputBuffer = remaining;
        if (remaining) {
          this.emitExecutionOutput(remaining);
        }
        return;
      }

      // Caracteres imprimíveis normais
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        this.stdinInputBuffer += data;
        this.emitExecutionOutput(data);
        return;
      }

      return;
    }

    // Se estiver executando (compilando ou calculando sem esperar stdin)
    if (this.isExecuting) {
      // Ctrl+C interrompe imediatamente
      if (data === '\x03') {
        this.stopExecution();
      }
      return;
    }

    // Console ocioso (não está executando nada)
    if (data === '\x03') {
      this.emitExecutionOutput('^C\r\n');
      return;
    }

    if (data === '\r' || data === '\n') {
      this.emitExecutionOutput('\r\n');
    }
  }

  /**
   * Compila e executa o código com separação estrita em abas de Compilação e Execução
   */
  public async runCode(
    mainFilename: string,
    folderFiles: Map<string, string>,
    extraCompilerArgs: string[] = [],
    vfsFiles?: { path: string; data: Uint8Array }[],
    onFilesUpdated?: (files: { path: string; data: Uint8Array; isNew?: boolean }[]) => void
  ) {
    if (this.isExecuting) {
      this.stopExecution();
    }

    // 1. Limpa ambos os terminais
    this.clearCompilationTerminal();
    this.clearExecutionTerminal();

    // 2. Inicia na aba de compilação
    this.setActiveTab('compilation');

    this.isExecuting = true;
    this.setStatus('running', `Compilando ${mainFilename}...`);

    const lower = mainFilename.toLowerCase();
    const isC = lower.endsWith('.c');
    const isCpp = lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx');
    const isHeader = lower.endsWith('.h') || lower.endsWith('.hpp');
    const binaryName = mainFilename.replace(/\.[^/.]+$/, '');

    if (isHeader) {
      this.emitCompilationOutput(
        `\x1b[33m[Aviso: '${mainFilename}' é um arquivo de cabeçalho (.h/.hpp). Abra o arquivo .c ou .cpp para executar]\x1b[0m\r\n`
      );
      this.isExecuting = false;
      this.setStatus('ready', 'Pronto');
      return;
    }

    if (!isC && !isCpp) {
      this.emitCompilationOutput(
        `\x1b[33m[Aviso: o TheProg Editor executa código C e C++ (.c, .cpp)]\x1b[0m\r\n`
      );
      this.isExecuting = false;
      this.setStatus('ready', 'Pronto');
      return;
    }

    // Coleta arquivos de código .c/.cpp no mesmo escopo de pasta, incluindo auxiliares sem main()
    const sources: string[] = [mainFilename];
    folderFiles.forEach((content, name) => {
      if (name !== mainFilename && (name.endsWith('.c') || name.endsWith('.cpp'))) {
        const hasMain = /\b(?:int|void)\s+main\s*\(/.test(content);
        if (!hasMain) {
          sources.push(name);
        }
      }
    });

    const compilerCmd = isCpp ? 'clang++' : 'clang';
    this.emitCompilationOutput(
      `\x1b[90m$ ${compilerCmd} -O0 ${sources.join(' ')} -o ${binaryName}.wasm\x1b[0m\r\n`
    );

    try {
      const compileResult = await compileC(
        sources,
        folderFiles,
        binaryName,
        (out) => {
          this.emitCompilationOutput(out);
        },
        extraCompilerArgs
      );

      const { wasmBinary, wasCached } = compileResult;

      if (!wasmBinary) {
        this.isExecuting = false;
        this.setStatus('error', 'Erro de compilação');
        this.emitCompilationOutput(`\r\n\x1b[31m[Falha na compilação: verifique os erros acima]\x1b[0m\r\n`);
        return;
      }

      this.emitCompilationOutput(
        `\x1b[32m[Compilação concluída com sucesso${wasCached ? ' (cached)' : ''}]\x1b[0m\r\n`
      );

      // 3. Compilação concluída: Alterna automaticamente para a aba de Execução
      this.setActiveTab('execution');
      this.setStatus('running', `Executando ${binaryName}...`);

      const startTime = performance.now();

      const exitCode = await executeWasmBinary(binaryName, wasmBinary, {
        onOutput: (out) => this.emitExecutionOutput(out),
        onNeedStdin: () => {
          this.isAwaitingProgramInput = true;
          this.stdinInputBuffer = '';
        },
        onControllerReady: (ctrl) => {
          this.currentWasmController = ctrl;
          this.currentAbortController = ctrl;
        },
        vfsFiles,
        onFsSync: onFilesUpdated,
      });

      const durationMs = performance.now() - startTime;
      const durationFormatted = (durationMs / 1000).toFixed(3) + 's';
      const cacheSuffix = wasCached ? ' (cached)' : '';

      this.currentWasmController = null;
      this.currentAbortController = null;
      this.isAwaitingProgramInput = false;
      this.stdinInputBuffer = '';
      this.isExecuting = false;

      this.setStatus(exitCode === 0 ? 'ready' : 'error', exitCode === 0 ? 'Concluído' : 'Finalizado com erro');
      if (exitCode === 0) {
        this.emitExecutionOutput(`\r\n\x1b[90m[Processo finalizado com sucesso em ${durationFormatted}${cacheSuffix}]\x1b[0m\r\n`);
      } else {
        this.emitExecutionOutput(`\r\n\x1b[31m[Processo finalizado com código ${exitCode} em ${durationFormatted}${cacheSuffix}]\x1b[0m\r\n`);
      }
    } catch (err: any) {
      console.error('Erro na execução:', err);
      if (this.activeTab === 'compilation') {
        this.emitCompilationOutput(`\r\n\x1b[31m[Erro: ${err?.message || err}]\x1b[0m\r\n`);
      } else {
        this.emitExecutionOutput(`\r\n\x1b[31m[Erro na execução: ${err?.message || err}]\x1b[0m\r\n`);
      }
      this.isExecuting = false;
      this.setStatus('error', 'Erro de execução');
    }
  }

  /**
   * Método de compatibilidade reversa
   */
  public async compileAndRun(filename: string, code: string) {
    const singleFileMap = new Map<string, string>();
    singleFileMap.set(filename, code);
    return this.runCode(filename, singleFileMap);
  }
}

export const vmManager = new VMManager();
