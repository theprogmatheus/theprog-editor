import type { VMStatus } from '../types/editor';
import type { RunPlan } from './languages/types';
import type { SyncedFile } from './runtimes/types';
import { processManager, type ProcessMetrics } from './process/processManager';

export type ConsoleTab = 'environment' | 'execution' | 'tests';

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
  private stdinInputBuffer: string = '';
  private lastMetrics: ProcessMetrics | null = null;

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
    return processManager.isRunning();
  }

  public syncFile(_filename: string, _content: string) {
    // Compatibilidade reversa: a sincronização ocorre no momento da execução.
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

  public getLastMetrics(): ProcessMetrics | null {
    return this.lastMetrics;
  }

  public stopExecution() {
    if (!processManager.isRunning()) return;
    this.emitExecutionOutput('\r\n\x1b[90m[Processo interrompido]\x1b[0m\r\n');
    this.emitEnvironmentOutput('\r\n\x1b[90m[Processo interrompido]\x1b[0m\r\n');
    processManager.terminate();
    this.stdinInputBuffer = '';
    this.setStatus('ready', 'Execução interrompida');
  }

  public sendInput(data: string) {
    const activeProc = processManager.getActiveProcess();

    if (activeProc?.isAwaitingInput) {
      if (data === '\x03') {
        this.stopExecution();
        return;
      }

      if (data === '\r' || data === '\n') {
        this.emitExecutionOutput('\r\n');
        this.stdinInputBuffer = '';
        processManager.sendInput(data);
        return;
      }

      if (data === '\x7f' || data === '\b') {
        if (this.stdinInputBuffer.length > 0) {
          this.stdinInputBuffer = this.stdinInputBuffer.slice(0, -1);
          this.emitExecutionOutput('\b \b');
        }
        processManager.sendInput(data);
        return;
      }

      if (data.includes('\r') || data.includes('\n')) {
        const full = this.stdinInputBuffer + data.replace(/\r\n|\r/g, '\n');
        const lines = full.split('\n');
        const remaining = lines.pop() || '';
        this.stdinInputBuffer = remaining;

        for (const line of lines) {
          this.emitExecutionOutput(line + '\r\n');
        }
        if (remaining) {
          this.emitExecutionOutput(remaining);
        }
        processManager.sendInput(data);
        return;
      }

      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        this.stdinInputBuffer += data;
        this.emitExecutionOutput(data);
        processManager.sendInput(data);
        return;
      }

      return;
    }

    if (processManager.isRunning()) {
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
   * Executa um plano de execução através do ProcessManager, garantindo isolamento por PID.
   */
  public async run(plan: RunPlan, options: RunOptions = {}) {
    if (processManager.isRunning()) {
      this.stopExecution();
    }

    this.clearEnvironmentTerminal();
    this.clearExecutionTerminal();
    this.setActiveTab('environment');
    this.stdinInputBuffer = '';
    this.setStatus('running', plan.statusMessage);

    let exitCode = 1;
    let procCached = false;

    exitCode = await processManager.spawn(plan, {
      onOutput: (text) => this.emitExecutionOutput(text),
      onEnvironmentOutput: (text) => this.emitEnvironmentOutput(text),
      onPhaseChange: (phase) => this.setActiveTab(phase),
      onStatusChange: (status, message) => {
        if (status === 'running') this.setStatus('running', message);
      },
      onFsSync: (files) => options.onFilesUpdated?.(files),
      onMetrics: (metrics) => {
        this.lastMetrics = metrics;
      },
    });

    const activeProc = processManager.getProcess(processManager.getActiveProcess()?.pid || 0);
    procCached = Boolean(activeProc?.cached);

    const durationMs = this.lastMetrics?.durationMs || 0;
    const durationFormatted = (durationMs / 1000).toFixed(3) + 's';
    const cacheSuffix = procCached ? ' (cached)' : '';

    this.setStatus(
      exitCode === 0 ? 'ready' : 'error',
      exitCode === 0 ? 'Concluído' : 'Finalizado com erro'
    );

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
