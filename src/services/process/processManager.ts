import type { RunPlan, RuntimeId } from '../languages/types';
import { runtimeManager } from '../runtimes/manager';
import type { RuntimeIO, StdinController, SyncedFile } from '../runtimes/types';

export type ProcessStatus = 'idle' | 'spawning' | 'running' | 'stopping' | 'terminated';

export interface ProcessMetrics {
  durationMs: number;
  heapBytes?: number;
}

export interface ProcessDescriptor {
  pid: number;
  runtime: RuntimeId;
  entryFile: string;
  status: ProcessStatus;
  stdinQueue: string[];
  isAwaitingInput: boolean;
  inputBuffer: string;
  controller: StdinController | null;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  cached?: boolean;
  metrics?: ProcessMetrics;
}

export interface ProcessIOCallbacks {
  onOutput: (text: string) => void;
  onEnvironmentOutput: (text: string) => void;
  onPhaseChange: (phase: 'environment' | 'execution') => void;
  onStatusChange: (status: ProcessStatus, message?: string) => void;
  onFsSync?: (files: SyncedFile[]) => void;
  onMetrics?: (metrics: ProcessMetrics) => void;
}

export class ProcessManager {
  private nextPid = 1;
  private processes = new Map<number, ProcessDescriptor>();
  private activePid: number | null = null;
  private statusListeners = new Set<(status: ProcessStatus, message?: string) => void>();

  public getActiveProcess(): ProcessDescriptor | null {
    if (this.activePid === null) return null;
    return this.processes.get(this.activePid) || null;
  }

  public getProcess(pid: number): ProcessDescriptor | undefined {
    return this.processes.get(pid);
  }

  public isRunning(): boolean {
    const active = this.getActiveProcess();
    return active !== null && (active.status === 'running' || active.status === 'spawning');
  }

  public subscribeStatus(listener: (status: ProcessStatus, message?: string) => void): () => void {
    this.statusListeners.add(listener);
    const active = this.getActiveProcess();
    listener(active ? active.status : 'idle');
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(process: ProcessDescriptor, message?: string) {
    this.statusListeners.forEach((l) => l(process.status, message));
  }

  /**
   * Encerra um processo ativo ou específico.
   * Se nenhum PID for fornecido, encerra o processo atualmente ativo.
   */
  public terminate(pid?: number): void {
    const targetPid = pid ?? this.activePid;
    if (targetPid === null || targetPid === undefined) return;

    const proc = this.processes.get(targetPid);
    if (!proc || proc.status === 'terminated') return;

    proc.status = 'stopping';
    if (proc.controller) {
      try {
        proc.controller.abort();
      } catch {
        // noop
      }
      proc.controller = null;
    }

    runtimeManager.terminate(proc.runtime);

    proc.status = 'terminated';
    proc.endTime = performance.now();
    proc.exitCode = 130;
    this.notifyStatus(proc, 'Processo interrompido');

    if (this.activePid === targetPid) {
      this.activePid = null;
    }
  }

  /**
   * Envia dados de entrada padrão (stdin) para o processo ativo com suporte a fila FIFO e buffer de edição.
   */
  public sendInput(data: string, pid?: number): boolean {
    const targetPid = pid ?? this.activePid;
    if (targetPid === null || targetPid === undefined) return false;

    const proc = this.processes.get(targetPid);
    if (!proc || proc.status !== 'running') return false;

    // Ctrl+C (interrupção de processo)
    if (data === '\x03') {
      this.terminate(proc.pid);
      return true;
    }

    if (proc.isAwaitingInput) {
      // Tecla Enter
      if (data === '\r' || data === '\n') {
        const toSend = proc.inputBuffer + '\n';
        proc.inputBuffer = '';
        proc.isAwaitingInput = false;
        if (proc.controller) {
          proc.controller.sendStdin(toSend);
        }
        return true;
      }

      // Tecla Backspace
      if (data === '\x7f' || data === '\b') {
        if (proc.inputBuffer.length > 0) {
          proc.inputBuffer = proc.inputBuffer.slice(0, -1);
        }
        return true;
      }

      // Colagem multi-linha ou bloco com quebras de linha
      if (data.includes('\r') || data.includes('\n')) {
        const full = proc.inputBuffer + data.replace(/\r\n|\r/g, '\n');
        const lines = full.split('\n');
        const remaining = lines.pop() || '';
        proc.inputBuffer = remaining;

        for (const line of lines) {
          proc.stdinQueue.push(line + '\n');
        }

        if (proc.stdinQueue.length > 0) {
          const next = proc.stdinQueue.shift()!;
          proc.isAwaitingInput = false;
          proc.controller?.sendStdin(next);
        }
        return true;
      }

      // Caractere imprimível comum
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        proc.inputBuffer += data;
        return true;
      }
    }

    return false;
  }

  /**
   * Spawna e executa um novo processo associado ao RunPlan, garantindo isolamento total por PID.
   */
  public async spawn(plan: RunPlan, io: ProcessIOCallbacks): Promise<number> {
    // Se já houver um processo em execução, interrompe com segurança
    if (this.activePid !== null) {
      this.terminate(this.activePid);
    }

    const pid = this.nextPid++;
    const proc: ProcessDescriptor = {
      pid,
      runtime: plan.runtime,
      entryFile: plan.entryFile,
      status: 'spawning',
      stdinQueue: [],
      isAwaitingInput: false,
      inputBuffer: '',
      controller: null,
      startTime: performance.now(),
    };

    this.processes.set(pid, proc);
    this.activePid = pid;

    proc.status = 'running';
    this.notifyStatus(proc, plan.statusMessage);
    io.onStatusChange('running', plan.statusMessage);

    const runtimeIO: RuntimeIO = {
      onOutput: (text) => {
        if (this.activePid !== pid || proc.status === 'terminated') return;
        io.onOutput(text);
      },
      onEnvironmentOutput: (text) => {
        if (this.activePid !== pid || proc.status === 'terminated') return;
        io.onEnvironmentOutput(text);
      },
      onPhaseChange: (phase) => {
        if (this.activePid !== pid || proc.status === 'terminated') return;
        io.onPhaseChange(phase);
      },
      onNeedStdin: () => {
        if (this.activePid !== pid || proc.status === 'terminated') return;
        if (proc.stdinQueue.length > 0) {
          const next = proc.stdinQueue.shift()!;
          proc.isAwaitingInput = false;
          proc.controller?.sendStdin(next);
        } else {
          proc.isAwaitingInput = true;
          proc.inputBuffer = '';
        }
      },
      onControllerReady: (controller) => {
        if (this.activePid !== pid || proc.status === 'terminated') {
          controller.abort();
          return;
        }
        proc.controller = controller;
      },
      onFsSync: (files) => {
        if (this.activePid !== pid || proc.status === 'terminated') return;
        io.onFsSync?.(files);
      },
      onMeta: (meta) => {
        if (this.activePid !== pid || proc.status === 'terminated') return;
        if (meta.cached !== undefined) proc.cached = meta.cached;
      },
    };

    let exitCode = 1;
    try {
      exitCode = await runtimeManager.run(plan.runtime, plan, runtimeIO);
    } catch (err: any) {
      if (this.activePid === pid && (proc.status as ProcessStatus) !== 'terminated') {
        io.onOutput(`\r\n\x1b[31m[Erro na execução: ${err?.message || err}]\x1b[0m\r\n`);
      }
      exitCode = 1;
    } finally {
      proc.endTime = performance.now();
      proc.exitCode = exitCode;
      proc.status = 'terminated';

      const durationMs = proc.endTime - proc.startTime;
      const metrics: ProcessMetrics = { durationMs };
      proc.metrics = metrics;
      io.onMetrics?.(metrics);

      if (this.activePid === pid) {
        this.activePid = null;
        this.notifyStatus(proc, exitCode === 0 ? 'Concluído' : 'Finalizado com erro');
        io.onStatusChange('terminated', exitCode === 0 ? 'Concluído' : 'Finalizado com erro');
      }
    }

    return exitCode;
  }
}

export const processManager = new ProcessManager();
