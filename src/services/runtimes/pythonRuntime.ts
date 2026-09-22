import type { RunPlan } from '../languages/types';
import type { InstalledWheel, RuntimeAdapter, RuntimeIO, RuntimeProgress } from './types';

const UNLOADED_PROGRESS: RuntimeProgress = {
  status: 'unloaded',
  percent: 0,
  doneBytes: 0,
  totalBytes: 0,
};

export interface PackageOperationEvent {
  type: 'status' | 'done' | 'error';
  message?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onEvent?: (event: PackageOperationEvent) => void;
}

interface ActiveRun {
  io: RuntimeIO;
  resolve: (code: number) => void;
  control: Int32Array;
  data: Uint8Array;
  interrupt: Uint8Array;
  terminated: boolean;
}

let requestCounter = 0;

class PythonRuntime implements RuntimeAdapter {
  readonly id = 'python' as const;
  readonly label = 'Python (Pyodide)';

  private worker: Worker | null = null;
  private progress: RuntimeProgress = { ...UNLOADED_PROGRESS };
  private listeners = new Set<(progress: RuntimeProgress) => void>();
  private preloadPromise: Promise<void> | null = null;
  private activeRun: ActiveRun | null = null;
  private pending = new Map<string, PendingRequest>();
  private wheelSink: ((wheel: InstalledWheel) => void) | null = null;
  private pyodideVersion: string | null = null;

  setWheelSink(sink: ((wheel: InstalledWheel) => void) | null): void {
    this.wheelSink = sink;
  }

  getPyodideVersion(): string | null {
    return this.pyodideVersion;
  }

  getProgress(): RuntimeProgress {
    return this.progress;
  }

  subscribeProgress(listener: (progress: RuntimeProgress) => void): () => void {
    this.listeners.add(listener);
    listener(this.progress);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateProgress(patch: Partial<RuntimeProgress>): void {
    this.progress = { ...this.progress, ...patch };
    this.listeners.forEach((listener) => listener(this.progress));
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../../workers/pythonWorker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
      this.worker.onerror = (err) => {
        const message = err?.message || 'Falha no worker Python';
        this.updateProgress({ status: 'error', error: message });
        if (this.activeRun) {
          this.activeRun.io.onEnvironmentOutput(
            `\r\n\x1b[31m[Erro no ambiente Python: ${message}]\x1b[0m\r\n`
          );
          const run = this.activeRun;
          this.activeRun = null;
          run.resolve(1);
        }
      };
    }
    return this.worker;
  }

  private destroyWorker(): void {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }
    this.preloadPromise = null;
    this.updateProgress({ ...UNLOADED_PROGRESS });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'preload_progress':
        this.updateProgress({
          status: 'loading',
          percent: message.percent ?? 0,
          doneBytes: message.doneBytes ?? 0,
          totalBytes: message.totalBytes ?? 0,
        });
        break;

      case 'preload_status':
        this.updateProgress({ status: 'loading', message: message.message });
        break;

      case 'preload_done':
        if (message.pyodideVersion) {
          this.pyodideVersion = String(message.pyodideVersion);
        }
        this.updateProgress({
          status: 'ready',
          percent: 100,
          doneBytes: this.progress.totalBytes || this.progress.doneBytes,
          totalBytes: this.progress.totalBytes || this.progress.doneBytes,
          message: undefined,
        });
        break;

      case 'preload_error':
        this.updateProgress({ status: 'error', percent: 0, error: message.error });
        break;

      case 'stdout':
        this.activeRun?.io.onOutput(message.text);
        break;

      case 'stderr':
        this.activeRun?.io.onOutput(
          String(message.text || '').includes('\x1b') ? message.text : `\x1b[31m${message.text}\x1b[0m`
        );
        break;

      case 'stdin_need':
        this.activeRun?.io.onNeedStdin();
        break;

      case 'fs_sync':
        this.activeRun?.io.onFsSync?.(message.files || []);
        break;

      case 'wheel_installed':
        if (message.data instanceof Uint8Array && message.fileName) {
          this.wheelSink?.({
            name: message.name,
            version: message.version,
            fileName: message.fileName,
            data: message.data,
          });
        }
        break;

      case 'exit': {
        const run = this.activeRun;
        if (run) {
          this.activeRun = null;
          run.resolve(typeof message.code === 'number' ? message.code : 0);
        }
        break;
      }

      case 'error': {
        const run = this.activeRun;
        if (run) {
          this.activeRun = null;
          run.io.onEnvironmentOutput(
            `\r\n\x1b[31m[Erro no ambiente Python: ${message.error}]\x1b[0m\r\n`
          );
          run.resolve(1);
        }
        break;
      }

      case 'packages_status': {
        const pending = this.pending.get(message.id);
        pending?.onEvent?.({ type: 'status', message: message.message });
        break;
      }

      case 'packages_done': {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.onEvent?.({ type: 'done' });
          pending.resolve(undefined);
        }
        break;
      }

      case 'packages_error': {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.onEvent?.({ type: 'error', message: message.error });
          pending.reject(new Error(message.error));
        }
        break;
      }

      case 'format_result': {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.resolve(message.code);
        }
        break;
      }

      case 'format_error': {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.reject(new Error(message.error));
        }
        break;
      }

      default:
        break;
    }
  }

  preload(): Promise<void> {
    if (this.progress.status === 'ready') return Promise.resolve();
    if (this.preloadPromise) return this.preloadPromise;

    this.updateProgress({ status: 'loading' });

    this.preloadPromise = new Promise<void>((resolve, reject) => {
      const worker = this.getWorker();
      const unsubscribe = this.subscribeProgress((progress) => {
        if (progress.status === 'ready') {
          unsubscribe();
          resolve();
        } else if (progress.status === 'error') {
          unsubscribe();
          this.preloadPromise = null;
          reject(new Error(progress.error || 'Falha ao carregar o Python'));
        }
      });
      worker.postMessage({ type: 'preload' });
    });

    return this.preloadPromise;
  }

  async run(plan: RunPlan, io: RuntimeIO): Promise<number> {
    if (this.progress.status !== 'ready') {
      io.onEnvironmentOutput(
        '\x1b[36m[TheProg] Inicializando ambiente Python (Pyodide) em background...\x1b[0m\r\n'
      );
      let lastPercent = -1;
      const unsubscribe = this.subscribeProgress((progress) => {
        if (progress.status === 'loading' && progress.percent !== lastPercent) {
          lastPercent = progress.percent;
          io.onEnvironmentOutput(
            `\r\x1b[K\x1b[33mCarregando Python: ${progress.percent}%...\x1b[0m`
          );
        }
      });
      try {
        await this.preload();
        io.onEnvironmentOutput('\r\x1b[K\x1b[32mAmbiente Python pronto!\x1b[0m\r\n');
      } catch (err: any) {
        io.onEnvironmentOutput(
          `\r\x1b[K\x1b[31mErro ao inicializar Python: ${err?.message || err}\x1b[0m\r\n`
        );
        return 1;
      } finally {
        unsubscribe();
      }
    } else {
      await this.preload();
    }

    io.onEnvironmentOutput(`\x1b[90m$ python ${plan.entryFile}\x1b[0m\r\n`);
    io.onPhaseChange('execution');

    const worker = this.getWorker();
    const sabControl = new SharedArrayBuffer(65536);
    const control = new Int32Array(sabControl, 0, 2);
    const data = new Uint8Array(sabControl, 8);
    const sabInterrupt = new SharedArrayBuffer(4);
    const interrupt = new Uint8Array(sabInterrupt);

    const encoder = new TextEncoder();
    const files = Array.from(plan.files.entries()).map(([path, content]) => {
      const bytes = encoder.encode(content);
      return { path, data: bytes };
    });

    const runId = `py-run-${++requestCounter}`;

    return new Promise<number>((resolve) => {
      this.activeRun = { io, resolve, control, data, interrupt, terminated: false };

      io.onControllerReady({
        sendStdin: (line: string) => {
          const run = this.activeRun;
          if (!run || run.terminated) return;
          const encoded = encoder.encode(line);
          data.set(encoded.subarray(0, 65520));
          Atomics.store(control, 1, Math.min(encoded.length, 65520));
          Atomics.store(control, 0, 1);
          Atomics.notify(control, 0);
        },
        abort: () => {
          Atomics.store(control, 0, -1);
          Atomics.notify(control, 0);
        },
      });

      const transfer = files.map((file) => file.data.buffer);
      worker.postMessage(
        {
          type: 'run',
          id: runId,
          entry: plan.entryFile,
          files,
          args: plan.args || [],
          sabControl,
          sabInterrupt,
        },
        transfer
      );
    });
  }

  terminate(): void {
    const run = this.activeRun;
    if (!run) return;

    run.terminated = true;
    run.interrupt[0] = 2;

    setTimeout(() => {
      if (this.activeRun === run) {
        this.activeRun = null;
        run.resolve(130);
        this.destroyWorker();
        this.updateProgress({ ...UNLOADED_PROGRESS });
      }
    }, 1500);
  }

  async installPackages(
    names: string[],
    onEvent?: (event: PackageOperationEvent) => void
  ): Promise<void> {
    await this.preload();
    const worker = this.getWorker();
    const id = `py-install-${++requestCounter}`;
    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, {
        resolve: () => resolve(),
        reject,
        onEvent,
      });
      worker.postMessage({ type: 'install_packages', id, names });
    });
  }

  restoreWheels(wheels: { fileName: string; data: Uint8Array }[]): void {
    if (!wheels.length) return;
    this.preload()
      .then(() => {
        const worker = this.getWorker();
        const transfer = wheels.map((wheel) => wheel.data.buffer);
        worker.postMessage({ type: 'restore_wheels', wheels }, transfer);
      })
      .catch(() => {
        // runtime indisponível; pacotes permanecem no cache do navegador
      });
  }

  async format(code: string): Promise<string> {
    await this.preload();
    const worker = this.getWorker();
    const id = `py-format-${++requestCounter}`;
    return new Promise<string>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(String(value)),
        reject,
      });
      worker.postMessage({ type: 'format', id, code });
    });
  }
}

export const pythonRuntime = new PythonRuntime();
