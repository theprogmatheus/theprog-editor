import type { VMStatus } from '../types/editor';
import { compileC, executeWasmBinary } from './cCompiler';

type OutputListener = (data: string) => void;
type StatusListener = (status: VMStatus, message?: string) => void;

class VMManager {
  public readonly PROMPT = 'theprog-editor:~$ ';
  private status: VMStatus = 'idle';
  private outputListeners: Set<OutputListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private v86Instance: any = null;

  // Readline Engine State
  private currentLine: string = '';
  private cursorPos: number = 0;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private savedCurrentInput: string = '';
  private isExecuting: boolean = false;
  private currentWasmController: { sendStdin: (line: string) => void; abort: () => void } | null = null;
  private currentAbortController: { abort: () => void } | null = null;
  private isAwaitingProgramInput: boolean = false;
  private stdinInputBuffer: string = '';
  private activeFiles: Map<string, string> = new Map();
  private compiledBinaries: Map<string, Uint8Array> = new Map();

  constructor() {
    this.setStatus('ready', 'Sistema pronto');
  }

  public subscribeOutput(listener: OutputListener): () => void {
    this.outputListeners.add(listener);
    return () => this.outputListeners.delete(listener);
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

  public emitOutput(text: string) {
    // Normalização estrita de quebras de linha para evitar escadinha / atropelamento no terminal
    const normalized = text.replace(/\r?\n/g, '\r\n');
    this.outputListeners.forEach((l) => l(normalized));
  }

  public getStatus(): VMStatus {
    return this.status;
  }


  public syncFile(filename: string, content: string) {
    this.activeFiles.set(filename, content);
    if (this.v86Instance && typeof this.v86Instance.create_file === 'function') {
      try {
        const encoder = new TextEncoder();
        this.v86Instance.create_file(`/root/workspace/${filename}`, encoder.encode(content));
      } catch (err) {
        console.warn('Erro ao sincronizar arquivo com v86:', err);
      }
    }
  }

  public clearTerminal() {
    this.currentLine = '';
    this.cursorPos = 0;
    this.historyIndex = -1;
    this.savedCurrentInput = '';
    // ANSI: 2J (limpa tela), 3J (limpa scrollback), H (cursor na posição 1,1)
    this.emitOutput(`\x1b[2J\x1b[3J\x1b[H${this.PROMPT}`);
  }

  public stopExecution() {
    if (!this.isExecuting && !this.isAwaitingProgramInput) return;
    this.emitOutput(`^C\r\n${this.PROMPT}`);
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
    this.currentLine = '';
    this.cursorPos = 0;
    this.historyIndex = -1;
    this.setStatus('ready', 'Execução interrompida');
  }

  public async initV86(alpineUrl?: string) {
    if (this.v86Instance) return;

    this.setStatus('booting', 'Inicializando kernel Linux...');

    try {
      const v86Module = await import('v86');
      const V86Starter = (v86Module as any).V86Starter || (v86Module as any).default?.V86Starter || (window as any).V86Starter;

      if (!V86Starter) {
        throw new Error('Módulo V86Starter não encontrado.');
      }

      const options: any = {
        wasm_path: `${import.meta.env.BASE_URL}v86/v86.wasm`,
        memory_size: 256 * 1024 * 1024,
        vga_memory_size: 4 * 1024 * 1024,
        bios: { url: `${import.meta.env.BASE_URL}v86/bios/seabios.bin` },
        vga_bios: { url: `${import.meta.env.BASE_URL}v86/bios/vgabios.bin` },
        autostart: true,
      };

      if (alpineUrl) {
        options.cdrom = { url: alpineUrl };
      }

      this.v86Instance = new V86Starter(options);

      this.v86Instance.add_listener('serial0-output-byte', (byte: number) => {
        this.emitOutput(String.fromCharCode(byte));
      });

      this.setStatus('ready', 'Linux pronto');
    } catch (err) {
      console.warn('V86 fallback mode:', err);
      this.setStatus('ready', 'Linux pronto');
      this.clearTerminal();
    }
  }

  public sendInput(data: string) {
    if (this.v86Instance && typeof this.v86Instance.serial0_send === 'function') {
      this.v86Instance.serial0_send(data);
      return;
    }

    // Se o programa em execução estiver aguardando entrada (scanf / stdin)
    if (this.isAwaitingProgramInput) {
      if (data === '\x03') {
        this.stopExecution();
        return;
      }

      if (data === '\r' || data === '\n') {
        this.emitOutput('\r\n');
        const toSend = this.stdinInputBuffer + '\n';
        this.stdinInputBuffer = '';
        this.isAwaitingProgramInput = false;
        if (this.currentWasmController) {
          this.currentWasmController.sendStdin(toSend);
        }
        return;
      }

      if (data === '\x7f' || data === '\b') {
        if (this.stdinInputBuffer.length > 0) {
          this.stdinInputBuffer = this.stdinInputBuffer.slice(0, -1);
          this.emitOutput('\b \b');
        }
        return;
      }

      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        this.stdinInputBuffer += data;
        this.emitOutput(data);
        return;
      }

      return;
    }

    // Se estiver executando e não estiver aguardando stdin (compilando / rodando)
    if (this.isExecuting) {
      // Permite apenas Ctrl+C para interromper
      if (data === '\x03') {
        this.stopExecution();
      }
      return;
    }

    // Modo Shell Interativo Padrão (Readline)

    // 1. Atalho Ctrl+C
    if (data === '\x03') {
      this.emitOutput(`^C\r\n${this.PROMPT}`);
      this.currentLine = '';
      this.cursorPos = 0;
      this.historyIndex = -1;
      this.savedCurrentInput = '';
      return;
    }

    // 2. Atalho Ctrl+L (Limpar Tela mantendo prompt e linha atual)
    if (data === '\x0c') {
      const lineToRestore = this.currentLine;
      const cursorToRestore = this.cursorPos;
      this.clearTerminal();
      if (lineToRestore) {
        this.outputListeners.forEach((l) => l(lineToRestore));
        this.currentLine = lineToRestore;
        this.cursorPos = lineToRestore.length;
        if (cursorToRestore < lineToRestore.length) {
          this.outputListeners.forEach((l) => l(`\x1b[${lineToRestore.length - cursorToRestore}D`));
          this.cursorPos = cursorToRestore;
        }
      }
      return;
    }

    // 3. Tab Completion
    if (data === '\t') {
      this.handleTabCompletion();
      return;
    }

    // 4. Tecla Enter
    if (data === '\r' || data === '\n') {
      this.emitOutput('\r\n');
      const cmd = this.currentLine.trim();

      if (cmd && this.commandHistory[this.commandHistory.length - 1] !== cmd) {
        this.commandHistory.push(cmd);
      }

      this.historyIndex = -1;
      this.savedCurrentInput = '';
      this.currentLine = '';
      this.cursorPos = 0;

      this.handleInteractiveCommand(cmd);
      return;
    }

    // 5. Seta para Cima (Histórico Anterior)
    if (data === '\x1b[A' || data === '\x1bOA') {
      if (this.commandHistory.length === 0) return;
      if (this.historyIndex === -1) {
        this.savedCurrentInput = this.currentLine;
        this.historyIndex = this.commandHistory.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.setCommandLine(this.commandHistory[this.historyIndex]);
      return;
    }

    // 6. Seta para Baixo (Histórico Seguinte)
    if (data === '\x1b[B' || data === '\x1bOB') {
      if (this.historyIndex === -1) return;
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.setCommandLine(this.commandHistory[this.historyIndex]);
      } else {
        this.historyIndex = -1;
        this.setCommandLine(this.savedCurrentInput);
      }
      return;
    }

    // 7. Seta para Esquerda (Navegar Cursor sem violar o prompt)
    if (data === '\x1b[D' || data === '\x1bOD') {
      if (this.cursorPos > 0) {
        this.cursorPos--;
        this.outputListeners.forEach((l) => l('\x1b[D'));
      }
      return;
    }

    // 8. Seta para Direita (Navegar Cursor até o fim da linha)
    if (data === '\x1b[C' || data === '\x1bOC') {
      if (this.cursorPos < this.currentLine.length) {
        this.cursorPos++;
        this.outputListeners.forEach((l) => l('\x1b[C'));
      }
      return;
    }

    // 9. Tecla Home (Início da Linha)
    if (data === '\x1b[H' || data === '\x1b[1~' || data === '\x1bOH') {
      if (this.cursorPos > 0) {
        this.outputListeners.forEach((l) => l(`\x1b[${this.cursorPos}D`));
        this.cursorPos = 0;
      }
      return;
    }

    // 10. Tecla End (Fim da Linha)
    if (data === '\x1b[F' || data === '\x1b[4~' || data === '\x1bOF') {
      if (this.cursorPos < this.currentLine.length) {
        this.outputListeners.forEach((l) => l(`\x1b[${this.currentLine.length - this.cursorPos}C`));
        this.cursorPos = this.currentLine.length;
      }
      return;
    }

    // 11. Tecla Delete
    if (data === '\x1b[3~') {
      if (this.cursorPos < this.currentLine.length) {
        const before = this.currentLine.slice(0, this.cursorPos);
        const after = this.currentLine.slice(this.cursorPos + 1);
        this.currentLine = before + after;
        const moveBack = after.length > 0 ? `\x1b[${after.length}D` : '';
        this.outputListeners.forEach((l) => l(`${after} \b${moveBack}`));
      }
      return;
    }

    // 12. Tecla Backspace (Blindagem do prompt e histórico)
    if (data === '\x7f' || data === '\b') {
      if (this.cursorPos === 0) {
        // Impossível apagar o prompt ou saídas anteriores
        return;
      }
      const before = this.currentLine.slice(0, this.cursorPos - 1);
      const after = this.currentLine.slice(this.cursorPos);
      this.currentLine = before + after;
      this.cursorPos--;
      const moveBack = after.length > 0 ? `\x1b[${after.length}D` : '';
      this.outputListeners.forEach((l) => l(`\b${after} \b${moveBack}`));
      return;
    }

    // 13. Texto normal / Caracteres digitados ou colados
    if (!data.startsWith('\x1b')) {
      this.insertTextAtCursor(data);
    }
  }

  private insertTextAtCursor(text: string) {
    const before = this.currentLine.slice(0, this.cursorPos);
    const after = this.currentLine.slice(this.cursorPos);
    this.currentLine = before + text + after;
    this.cursorPos += text.length;

    if (after.length === 0) {
      this.outputListeners.forEach((l) => l(text));
    } else {
      const moveBack = `\x1b[${after.length}D`;
      this.outputListeners.forEach((l) => l(`${text}${after}${moveBack}`));
    }
  }

  private setCommandLine(newLine: string) {
    let backStr = '';
    if (this.cursorPos > 0) {
      backStr = `\x1b[${this.cursorPos}D`;
    }
    this.outputListeners.forEach((l) => l(`${backStr}\x1b[K${newLine}`));
    this.currentLine = newLine;
    this.cursorPos = newLine.length;
  }

  private handleTabCompletion() {
    const textBeforeCursor = this.currentLine.slice(0, this.cursorPos);
    const tokens = textBeforeCursor.split(' ');
    const currentToken = tokens[tokens.length - 1] || '';

    const isFirstToken = tokens.length === 1;
    const commandCandidates = [
      'gcc', 'g++', 'clear', 'ls', 'cat', 'pwd', 'whoami', 'uname', './main'
    ];
    const fileCandidates = Array.from(this.activeFiles.keys());

    const pool = isFirstToken ? [...commandCandidates, ...fileCandidates] : fileCandidates;
    const matches = pool.filter((item) => item.startsWith(currentToken));

    if (matches.length === 1) {
      const match = matches[0];
      const remainder = match.slice(currentToken.length) + ' ';
      this.insertTextAtCursor(remainder);
    } else if (matches.length > 1) {
      const commonPrefix = this.findCommonPrefix(matches);
      if (commonPrefix.length > currentToken.length) {
        const remainder = commonPrefix.slice(currentToken.length);
        this.insertTextAtCursor(remainder);
      } else {
        this.emitOutput('\r\n' + matches.join('  ') + '\r\n' + this.PROMPT + this.currentLine);
        if (this.cursorPos < this.currentLine.length) {
          this.outputListeners.forEach((l) => l(`\x1b[${this.currentLine.length - this.cursorPos}D`));
        }
      }
    }
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (strings[i].indexOf(prefix) !== 0) {
        prefix = prefix.slice(0, prefix.length - 1);
        if (prefix === '') return '';
      }
    }
    return prefix;
  }

  private async handleInteractiveCommand(rawCmd: string) {
    const trimmed = rawCmd.trim();
    if (trimmed === 'clear') {
      this.clearTerminal();
      return;
    }

    // Suporte a encadeamento com && (ex: gcc main.c ex1.c -o main && ./main)
    if (rawCmd.includes('&&')) {
      const subCmds = rawCmd.split('&&').map((s) => s.trim()).filter(Boolean);
      let lastCmd = '';
      for (const sub of subCmds) {
        lastCmd = sub.split(/\s+/)[0] || '';
        const ok = await this.executeSingleCommand(sub);
        if (!ok) break;
      }
      if (lastCmd !== 'clear') {
        this.emitOutput(this.PROMPT);
      }
      return;
    }

    await this.executeSingleCommand(rawCmd);
    this.emitOutput(this.PROMPT);
  }

  private async executeSingleCommand(rawCmd: string): Promise<boolean> {
    const parts = rawCmd.split(/\s+/).filter(Boolean);
    const cmd = parts[0] || '';

    if (!cmd) return true;

    switch (cmd) {
      case 'clear':
        this.clearTerminal();
        return true;

      case 'ls': {
        const fileList = Array.from(this.activeFiles.keys()).join('  ');
        if (fileList) {
          this.emitOutput(fileList + '\r\n');
        }
        return true;
      }

      case 'cat': {
        const targetFile = parts[1];
        if (!targetFile) {
          this.emitOutput('cat: missing operand\r\n');
          return false;
        } else if (this.activeFiles.has(targetFile)) {
          const content = this.activeFiles.get(targetFile)!;
          this.emitOutput(content.replace(/\r?\n/g, '\r\n') + '\r\n');
          return true;
        } else {
          this.emitOutput(`cat: ${targetFile}: No such file or directory\r\n`);
          return false;
        }
      }

      case 'uname':
        this.emitOutput('Linux theprog 6.6.14-0-virt #1 SMP PREEMPT_DYNAMIC x86 Linux\r\n');
        return true;

      case 'whoami':
        this.emitOutput('root\r\n');
        return true;

      case 'pwd':
        this.emitOutput('/root/workspace\r\n');
        return true;

      case 'gcc':
      case 'g++': {
        const specifiedSources = parts.filter((p) => p.endsWith('.c') || p.endsWith('.cpp'));
        if (specifiedSources.length === 0) {
          this.emitOutput(`${cmd}: fatal error: no input files\r\ncompilation terminated.\r\n`);
          return false;
        }

        let outBinaryName = 'main';
        const oIdx = parts.indexOf('-o');
        if (oIdx !== -1 && parts[oIdx + 1] && !parts[oIdx + 1].startsWith('-')) {
          outBinaryName = parts[oIdx + 1];
        }

        const missing = specifiedSources.find((s) => !this.activeFiles.has(s));
        if (missing) {
          this.emitOutput(`${cmd}: error: ${missing}: No such file or directory\r\n`);
          return false;
        }

        this.isExecuting = true;
        this.setStatus('running', 'Compilando com Clang...');

        const wasmBinary = await compileC(specifiedSources, this.activeFiles, outBinaryName, (out) => {
          this.emitOutput(out);
        });

        if (wasmBinary) {
          this.compiledBinaries.set(outBinaryName, wasmBinary);
          this.compiledBinaries.set(`./${outBinaryName}`, wasmBinary);
          this.isExecuting = false;
          this.setStatus('ready');
          return true;
        } else {
          if (specifiedSources.length === 1) {
            const others: string[] = [];
            this.activeFiles.forEach((_, name) => {
              if (name !== specifiedSources[0] && (name.endsWith('.c') || name.endsWith('.cpp'))) {
                others.push(name);
              }
            });
            if (others.length > 0) {
              this.emitOutput(`\r\n\x1b[33mdica: se a função estiver em outro arquivo, inclua-o: ${cmd} ${specifiedSources[0]} ${others.join(' ')} -o ${outBinaryName} && ./${outBinaryName}\x1b[0m\r\n`);
            }
          }
          this.isExecuting = false;
          this.setStatus('error');
          return false;
        }
      }

      default: {
        // Se for execução de binário, ex: ./main ou main
        if (cmd.startsWith('./') || this.compiledBinaries.has(cmd)) {
          const binKey = cmd.startsWith('./') ? cmd.slice(2) : cmd;
          const wasmBinary = this.compiledBinaries.get(binKey) || this.compiledBinaries.get(cmd);

          if (wasmBinary) {
            this.isExecuting = true;
            this.setStatus('running', `Executando ${cmd}...`);
            const exitCode = await executeWasmBinary(binKey, wasmBinary, {
              onOutput: (out) => this.emitOutput(out),
              onNeedStdin: () => {
                this.isAwaitingProgramInput = true;
                this.stdinInputBuffer = '';
              },
              onControllerReady: (ctrl) => {
                this.currentWasmController = ctrl;
                this.currentAbortController = ctrl;
              },
            });
            this.currentWasmController = null;
            this.currentAbortController = null;
            this.isAwaitingProgramInput = false;
            this.stdinInputBuffer = '';
            this.isExecuting = false;
            this.setStatus(exitCode === 0 ? 'ready' : 'error');
            return exitCode === 0;
          }

          this.emitOutput(`sh: ${cmd}: No such file or directory\r\n`);
          return false;
        }

        this.emitOutput(`sh: ${cmd}: not found\r\n`);
        return false;
      }
    }
  }

  /**
   * Compila e executa o código com compilador nativo autêntico
   */
  public async compileAndRun(filename: string, code: string) {
    if (this.isExecuting) {
      this.isExecuting = false;
    }

    this.isExecuting = true;
    this.activeFiles.set(filename, code);
    this.setStatus('running', `Executando ${filename}...`);

    this.currentLine = '';
    this.cursorPos = 0;
    this.historyIndex = -1;

    const lower = filename.toLowerCase();
    const isC = lower.endsWith('.c');
    const isCpp = lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx');
    const isHeader = lower.endsWith('.h') || lower.endsWith('.hpp');
    const binaryName = filename.replace(/\.[^/.]+$/, '');

    // Se for cabeçalho
    if (isHeader) {
      this.emitOutput(`\r\x1b[K${this.PROMPT}\r\n\x1b[33mAviso: '${filename}' é um arquivo de cabeçalho (.h/.hpp). Para executar, abra o arquivo .c ou .cpp correspondente.\x1b[0m\r\n`);
      this.isExecuting = false;
      this.setStatus('ready', 'Pronto');
      this.emitOutput(this.PROMPT);
      return;
    }

    // Se não for C nem C++
    if (!isC && !isCpp) {
      this.emitOutput(`\r\x1b[K${this.PROMPT}\r\n\x1b[33mO TheProg Editor é focado exclusivamente em C e C++ (.c, .cpp). Para executar seu código, abra um arquivo C ou C++.\x1b[0m\r\n`);
      this.isExecuting = false;
      this.setStatus('ready', 'Pronto');
      this.emitOutput(this.PROMPT);
      return;
    }

    const compiler = isCpp ? 'g++' : 'gcc';
    const sources: string[] = [filename];

    // Inclui arquivos auxiliares .c / .cpp do workspace, excluindo arquivos que tenham sua própria função main()
    this.activeFiles.forEach((content, name) => {
      if (name !== filename && (name.endsWith('.c') || name.endsWith('.cpp'))) {
        const hasMain = /\b(?:int|void)\s+main\s*\(/.test(content);
        if (!hasMain) {
          sources.push(name);
        }
      }
    });

    const sourcesStr = sources.join(' ');
    this.emitOutput(`\r\x1b[K${this.PROMPT}${compiler} ${sourcesStr} -o ${binaryName} && ./${binaryName}\r\n`);

    if (this.v86Instance && typeof this.v86Instance.serial0_send === 'function') {
      this.syncFile(filename, code);
      this.v86Instance.serial0_send(`${compiler} ${sourcesStr} -o ${binaryName} && ./${binaryName}\n`);
      this.isExecuting = false;
      this.setStatus('ready');
      return;
    }

    // Compilação real nativa com Clang WebAssembly + WASI
    try {
      const wasmBinary = await compileC(sources, this.activeFiles, binaryName, (out) => {
        this.emitOutput(out);
      });

      if (wasmBinary) {
        this.compiledBinaries.set(binaryName, wasmBinary);
        this.compiledBinaries.set(`./${binaryName}`, wasmBinary);

        const exitCode = await executeWasmBinary(binaryName, wasmBinary, {
          onOutput: (out) => this.emitOutput(out),
          onNeedStdin: () => {
            this.isAwaitingProgramInput = true;
            this.stdinInputBuffer = '';
          },
          onControllerReady: (ctrl) => {
            this.currentWasmController = ctrl;
            this.currentAbortController = ctrl;
          },
        });
        this.currentWasmController = null;
        this.currentAbortController = null;
        this.isAwaitingProgramInput = false;
        this.stdinInputBuffer = '';
        this.isExecuting = false;
        this.setStatus(exitCode === 0 ? 'ready' : 'error', exitCode === 0 ? 'Pronto' : 'Erro');
        this.emitOutput(this.PROMPT);
        return;
      } else {
        this.isExecuting = false;
        this.setStatus('error', 'Erro de compilação');
        this.emitOutput(this.PROMPT);
        return;
      }
    } catch (compileErr: any) {
      console.warn('Erro ao compilar com Clang:', compileErr);
      this.emitOutput(`\r\n\x1b[31merro: falha interna de compilação: ${compileErr?.message || compileErr}\x1b[0m\r\n`);
      this.isExecuting = false;
      this.setStatus('error', 'Erro de compilação');
      this.emitOutput(this.PROMPT);
      return;
    }
  }
}

export const vmManager = new VMManager();
