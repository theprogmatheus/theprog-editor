import type { RunPlan } from '../languages/types';
import type { RuntimeAdapter, RuntimeIO, RuntimeProgress } from './types';

const UNLOADED_PROGRESS: RuntimeProgress = {
  status: 'unloaded',
  percent: 0,
  doneBytes: 0,
  totalBytes: 0,
};

interface PendingBundle {
  resolve: (code: string) => void;
  reject: (error: Error) => void;
}

interface ActiveRun {
  io: RuntimeIO;
  resolve: (code: number) => void;
  worker: Worker;
}

let requestCounter = 0;

class JsRuntime implements RuntimeAdapter {
  readonly id = 'js' as const;
  readonly label = 'JavaScript/TypeScript (esbuild)';

  private bundler: Worker | null = null;
  private progress: RuntimeProgress = { ...UNLOADED_PROGRESS };
  private listeners = new Set<(progress: RuntimeProgress) => void>();
  private preloadPromise: Promise<void> | null = null;
  private pendingBundles = new Map<string, PendingBundle>();
  private activeRun: ActiveRun | null = null;

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

  private getBundler(): Worker {
    if (!this.bundler) {
      this.bundler = new Worker(new URL('../../workers/bundlerWorker.ts', import.meta.url), {
        type: 'module',
      });
      this.bundler.onmessage = (event: MessageEvent) => this.handleBundlerMessage(event.data);
      this.bundler.onerror = (err) => {
        const message = err?.message || 'Falha no empacotador JavaScript';
        this.updateProgress({ status: 'error', error: message });
        this.pendingBundles.forEach((pending) => pending.reject(new Error(message)));
        this.pendingBundles.clear();
      };    }
    return this.bundler;
  }

  private handleBundlerMessage(message: any): void {
    switch (message.type) {
      case 'init_progress':
        this.updateProgress({
          status: 'loading',
          percent: message.percent ?? 0,
          doneBytes: message.doneBytes ?? 0,
          totalBytes: message.totalBytes ?? 0,
          message: 'Baixando empacotador JavaScript (esbuild)...',
        });
        break;

      case 'init_done':
        this.updateProgress({
          status: 'ready',
          percent: 100,
          doneBytes: this.progress.totalBytes || this.progress.doneBytes,
          totalBytes: this.progress.totalBytes || this.progress.doneBytes,
          message: undefined,
        });
        break;

      case 'init_error':
        this.updateProgress({ status: 'error', error: message.error });
        break;

      case 'bundle_done': {
        const pending = this.pendingBundles.get(message.id);
        if (pending) {
          this.pendingBundles.delete(message.id);
          pending.resolve(message.code);
        }
        break;
      }

      case 'bundle_error': {
        const pending = this.pendingBundles.get(message.id);
        if (pending) {
          this.pendingBundles.delete(message.id);
          const formatted = (message.errors || [])
            .map((error: any) => {
              const location = error.file
                ? `${error.file}${error.line ? `:${error.line}${error.column ? `:${error.column}` : ''}` : ''} — `
                : '';
              return `\x1b[31m✘ [ERRO]\x1b[0m ${location}${error.text}`;
            })
            .join('\r\n');
          pending.reject(new Error(formatted || 'Falha ao empacotar o código'));
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
      const worker = this.getBundler();
      const unsubscribe = this.subscribeProgress((progress) => {
        if (progress.status === 'ready') {
          unsubscribe();
          resolve();
        } else if (progress.status === 'error') {
          unsubscribe();
          this.preloadPromise = null;
          reject(new Error(progress.error || 'Falha ao carregar o empacotador JavaScript'));
        }
      });
      worker.postMessage({ type: 'init' });
    });

    return this.preloadPromise;
  }

  private bundle(entry: string, files: Map<string, string>): Promise<string> {
    const worker = this.getBundler();
    const id = `js-bundle-${++requestCounter}`;
    return new Promise<string>((resolve, reject) => {
      this.pendingBundles.set(id, { resolve, reject });
      worker.postMessage({ type: 'bundle', id, entry, files: Array.from(files.entries()) });
    });
  }

  async run(plan: RunPlan, io: RuntimeIO): Promise<number> {
    if (this.progress.status !== 'ready') {
      io.onEnvironmentOutput(
        '\x1b[36m[TheProg] Inicializando empacotador JavaScript (esbuild) em background...\x1b[0m\r\n'
      );
      let lastPercent = -1;
      const unsubscribe = this.subscribeProgress((progress) => {
        if (progress.status === 'loading' && progress.percent !== lastPercent) {
          lastPercent = progress.percent;
          io.onEnvironmentOutput(
            `\r\x1b[K\x1b[33mCarregando JavaScript/TypeScript: ${progress.percent}%...\x1b[0m`
          );
        }
      });
      try {
        await this.preload();
        io.onEnvironmentOutput('\r\x1b[K\x1b[32mAmbiente JavaScript/TypeScript pronto!\x1b[0m\r\n');
      } catch (err: any) {
        io.onEnvironmentOutput(
          `\r\x1b[K\x1b[31mErro ao inicializar JavaScript/TypeScript: ${err?.message || err}\x1b[0m\r\n`
        );
        return 1;
      } finally {
        unsubscribe();
      }
    } else {
      await this.preload();
    }

    const entry = plan.entryFile.replace(/^\.?\//, '');
    io.onEnvironmentOutput(`\x1b[90m$ esbuild ${entry} --bundle --format=iife\x1b[0m\r\n`);

    let bundledCode = '';
    try {
      bundledCode = await this.bundle(entry, plan.files);
    } catch (err: any) {
      io.onEnvironmentOutput(`\r\n${err?.message || err}\r\n`);
      return 1;
    }

    io.onPhaseChange('execution');

    if (typeof SharedArrayBuffer === 'undefined') {
      io.onEnvironmentOutput(
        '\r\n\x1b[31m[Erro: SharedArrayBuffer não está disponível no navegador. Verifique os headers COOP/COEP.]\x1b[0m\r\n'
      );
      return 1;
    }

    const worker = new Worker(new URL('../../workers/jsWorker.ts', import.meta.url), {
      type: 'module',
    });

    const sabControl = new SharedArrayBuffer(65536);
    const control = new Int32Array(sabControl, 0, 2);
    const data = new Uint8Array(sabControl, 8);
    const encoder = new TextEncoder();
    const runId = `js-run-${++requestCounter}`;

    return new Promise<number>((resolve) => {
      this.activeRun = { io, resolve, worker };

      io.onControllerReady({
        sendStdin: (line: string) => {
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

      worker.onmessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'stdout') {
          io.onOutput(String(message.text).replace(/\r?\n/g, '\r\n'));
        } else if (message.type === 'stderr') {
          io.onOutput(String(message.text).replace(/\r?\n/g, '\r\n'));
        } else if (message.type === 'stdin_need') {
          io.onNeedStdin();
        } else if (message.type === 'exit') {
          this.finishRun(typeof message.code === 'number' ? message.code : 0);
        } else if (message.type === 'error') {
          io.onEnvironmentOutput(
            `\r\n\x1b[31m[Erro de execução: ${message.error}]\x1b[0m\r\n`
          );
          this.finishRun(1);
        }
      };

      worker.onerror = (err) => {
        const detail = err?.message ? `: ${err.message}` : '';
        io.onEnvironmentOutput(
          `\r\n\x1b[31m[Falha ao carregar o executor JavaScript${detail}]\x1b[0m\r\n` +
            '\x1b[90mSe o aplicativo foi atualizado recentemente, recarregue a página (Ctrl+Shift+R) e tente novamente.\x1b[0m\r\n'
        );
        this.finishRun(1);
      };

      worker.postMessage({
        type: 'run',
        id: runId,
        code: bundledCode,
        entry,
        argv: plan.args || [],
        sabControl,
      });
    });
  }

  private finishRun(code: number): void {
    const run = this.activeRun;
    if (!run) return;
    this.activeRun = null;
    try {
      run.worker.terminate();
    } catch {
      // ignore
    }
    run.resolve(code);
  }

  terminate(): void {
    if (this.activeRun) {
      this.activeRun.io.onEnvironmentOutput('\r\n\x1b[90m[Execução interrompida]\x1b[0m\r\n');
      this.finishRun(130);
    }
  }
}

export const jsRuntime = new JsRuntime();
