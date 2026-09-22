import type { VMStatus } from '../types/editor';
import type { RunPlan, RuntimeId } from './languages/types';
import { runtimeManager } from './runtimes/manager';
import type { RuntimeIO, StdinController, SyncedFile } from './runtimes/types';

export type ConsoleTab = 'environment' | 'execution';

type OutputListener = (data: string) => void;
type StatusListener = (status: VMStatus, message?: string) => void;

export interface RunOptions {
  onFilesUpdated?: (files: SyncedFile[]) => void;
}

class VMManager {
  public readonly PROMPT = '';
  private status: VMStatus = 'idle';
  private activeTab: ConsoleTab = 'execution';
  private tabListeners: Set<(tab: ConsoleTab) => void> = new Set();
  private environmentListeners: Set<OutputListener> = new Set();
  private executionListeners: Set<OutputListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  private isExecuting: boolean = false;
  private currentController: StdinController | null = null;
  private activeRuntime: RuntimeId | null = null;
  private isAwaitingProgramInput: boolean = false;
  private stdinInputBuffer: string = '';
  private lastRunWasCached = false;

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

  public subscribeEnvironmentOutput(listener: OutputListener): () => void {
    this.environmentListeners.add(listener);
    return () => this.environmentListeners.delete(listener);
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

  public emitEnvironmentOutput(text: string) {
    const normalized = text.replace(/\r?\n/g, '\r\n');
    this.environmentListeners.forEach((l) => l(normalized));
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

  public isRunning(): boolean {
    return this.isExecuting;
  }

  public syncFile(_filename: string, _content: string) {
    // Compatibilidade reversa: a sincronização agora ocorre no momento da execução.
  }

  public clearEnvironmentTerminal() {
    this.emitEnvironmentOutput('\x1b[2J\x1b[3J\x1b[H');
  }

  public clearExecutionTerminal() {
    this.stdinInputBuffer = '';
    this.emitExecutionOutput('\x1b[2J\x1b[3J\x1b[H');
  }

  public clearTerminal() {
    this.clearEnvironmentTerminal();
    this.clearExecutionTerminal();
  }

  public stopExecution() {
    if (!this.isExecuting && !this.isAwaitingProgramInput) return;
    this.emitExecutionOutput('\r\n\x1b[90m[Processo interrompido]\x1b[0m\r\n');
    this.emitEnvironmentOutput('\r\n\x1b[90m[Processo interrompido]\x1b[0m\r\n');
    if (this.currentController) {
      try {
        this.currentController.abort();
      } catch {
        // ignore
      }
      this.currentController = null;
    }
    runtimeManager.terminate(this.activeRuntime);
    this.isExecuting = false;
    this.isAwaitingProgramInput = false;
    this.stdinInputBuffer = '';
    this.setStatus('ready', 'Execução interrompida');
  }

  public sendInput(data: string) {
    if (this.isAwaitingProgramInput) {
      if (data === '\x03') {
        this.stopExecution();
        return;
      }

      if (data === '\r' || data === '\n') {
        this.emitExecutionOutput('\r\n');
        const toSend = this.stdinInputBuffer + '\n';
        this.stdinInputBuffer = '';
        this.isAwaitingProgramInput = false;
        if (this.currentController) {
          this.currentController.sendStdin(toSend);
        }
        return;
      }

      if (data === '\x7f' || data === '\b') {
        if (this.stdinInputBuffer.length > 0) {
          this.stdinInputBuffer = this.stdinInputBuffer.slice(0, -1);
          this.emitExecutionOutput('\b \b');
        }
        return;
      }

      if (data.includes('\r') || data.includes('\n')) {
        const full = this.stdinInputBuffer + data.replace(/\r\n|\r/g, '\n');
        const lines = full.split('\n');
        const remaining = lines.pop() || '';
        for (const line of lines) {
          this.emitExecutionOutput(line + '\r\n');
          this.currentController?.sendStdin(line + '\n');
        }
        this.stdinInputBuffer = remaining;
        if (remaining) {
          this.emitExecutionOutput(remaining);
        }
        return;
      }

      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        this.stdinInputBuffer += data;
        this.emitExecutionOutput(data);
        return;
      }

      return;
    }

    if (this.isExecuting) {
      if (data === '\x03') {
        this.stopExecution();
      }
      return;
    }

    if (data === '\x03') {
      this.emitExecutionOutput('^C\r\n');
      return;
    }

    if (data === '\r' || data === '\n') {
      this.emitExecutionOutput('\r\n');
    }
  }

  /**
   * Executa um plano de execução em qualquer runtime (C/C++, Python, JS/TS).
   * O console mantém as abas "Ambiente" (build/carregamento) e "Execução" (programa).
   */
  public async run(plan: RunPlan, options: RunOptions = {}) {
    if (this.isExecuting) {
      this.stopExecution();
    }

    this.clearEnvironmentTerminal();
    this.clearExecutionTerminal();
    this.setActiveTab('environment');

    this.isExecuting = true;
    this.activeRuntime = plan.runtime;
    this.lastRunWasCached = false;
    this.setStatus('running', plan.statusMessage);

    const io: RuntimeIO = {
      onOutput: (text) => this.emitExecutionOutput(text),
      onEnvironmentOutput: (text) => this.emitEnvironmentOutput(text),
      onPhaseChange: (phase) => this.setActiveTab(phase),
      onNeedStdin: () => {
        this.isAwaitingProgramInput = true;
        this.stdinInputBuffer = '';
      },
      onControllerReady: (controller) => {
        this.currentController = controller;
      },
      onFsSync: (files) => options.onFilesUpdated?.(files),
      onMeta: (meta) => {
        if (meta.cached !== undefined) this.lastRunWasCached = meta.cached;
      },
    };

    const startTime = performance.now();
    let exitCode = 1;

    try {
      exitCode = await runtimeManager.run(plan.runtime, plan, io);
    } catch (err: any) {
      this.emitExecutionOutput(`\r\n\x1b[31m[Erro na execução: ${err?.message || err}]\x1b[0m\r\n`);
      exitCode = 1;
    }

    const durationMs = performance.now() - startTime;
    const durationFormatted = (durationMs / 1000).toFixed(3) + 's';
    const cacheSuffix = this.lastRunWasCached ? ' (cached)' : '';

    this.currentController = null;
    this.activeRuntime = null;
    this.isAwaitingProgramInput = false;
    this.stdinInputBuffer = '';
    this.isExecuting = false;

    this.setStatus(exitCode === 0 ? 'ready' : 'error', exitCode === 0 ? 'Concluído' : 'Finalizado com erro');

    if (exitCode === 0) {
      this.emitExecutionOutput(
        `\r\n\x1b[90m[Processo finalizado com sucesso em ${durationFormatted}${cacheSuffix}]\x1b[0m\r\n`
      );
    } else if (exitCode !== 130) {
      this.emitExecutionOutput(
        `\r\n\x1b[31m[Processo finalizado com código ${exitCode} em ${durationFormatted}${cacheSuffix}]\x1b[0m\r\n`
      );
    }
  }
}

export const vmManager = new VMManager();
