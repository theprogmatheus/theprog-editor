import type { RunPlan, RuntimeId } from '../languages/types';
import type { RuntimeAdapter, RuntimeIO, RuntimeProgress, RuntimeProgressMap } from './types';
import { clangRuntime } from './clangRuntime';
import { pythonRuntime } from './pythonRuntime';
import { jsRuntime } from './jsRuntime';

export interface RuntimeAggregate {
  percent: number;
  doneBytes: number;
  totalBytes: number;
  allReady: boolean;
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
}

type ProgressListener = (progress: RuntimeProgressMap) => void;

class RuntimeManager {
  private adapters = new Map<RuntimeId, RuntimeAdapter>();
  private progress: RuntimeProgressMap = {};
  private listeners = new Set<ProgressListener>();

  register(adapter: RuntimeAdapter): void {
    if (this.adapters.has(adapter.id)) return;
    this.adapters.set(adapter.id, adapter);
    this.progress = { ...this.progress, [adapter.id]: adapter.getProgress() };
    adapter.subscribeProgress((progress) => {
      this.progress = { ...this.progress, [adapter.id]: progress };
      this.listeners.forEach((listener) => listener(this.progress));
    });
  }

  getProgress(): RuntimeProgressMap {
    return this.progress;
  }

  getAdapter(id: RuntimeId): RuntimeAdapter | undefined {
    return this.adapters.get(id);
  }

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    listener(this.progress);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getAggregate(): RuntimeAggregate {
    const entries = Object.values(this.progress).filter(Boolean) as RuntimeProgress[];
    let doneBytes = 0;
    let totalBytes = 0;
    let allReady = entries.length > 0;
    let isLoading = false;
    let hasError = false;
    let errorMessage: string | undefined;

    for (const progress of entries) {
      doneBytes += progress.doneBytes;
      totalBytes += progress.totalBytes;
      if (progress.status !== 'ready') allReady = false;
      if (progress.status === 'loading') isLoading = true;
      if (progress.status === 'error') {
        hasError = true;
        errorMessage = errorMessage || progress.error;
      }
    }

    const percent =
      totalBytes > 0
        ? Math.min(100, Math.round((doneBytes / totalBytes) * 100))
        : allReady
          ? 100
          : 0;

    return { percent, doneBytes, totalBytes, allReady, isLoading, hasError, errorMessage };
  }

  async preload(runtime: RuntimeId): Promise<void> {
    const adapter = this.adapters.get(runtime);
    if (!adapter) return;
    await adapter.preload();
  }

  async preloadAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.adapters.values()).map((adapter) => adapter.preload())
    );
  }

  async run(runtime: RuntimeId, plan: RunPlan, io: RuntimeIO): Promise<number> {
    const adapter = this.adapters.get(runtime);
    if (!adapter) {
      io.onEnvironmentOutput(
        `\r\n\x1b[31m[Ambiente de execução '${runtime}' não registrado]\x1b[0m\r\n`
      );
      return 1;
    }
    return adapter.run(plan, io);
  }

  terminate(runtime: RuntimeId | null): void {
    if (!runtime) return;
    this.adapters.get(runtime)?.terminate();
  }

  /** Formata código Python usando o runtime Python (black). */
  async formatPython(code: string): Promise<string | null> {
    const adapter = this.adapters.get('python') as
      | (RuntimeAdapter & { format?: (code: string) => Promise<string> })
      | undefined;
    if (!adapter?.format) return null;
    return adapter.format(code);
  }
}

export const runtimeManager = new RuntimeManager();

runtimeManager.register(clangRuntime);
runtimeManager.register(pythonRuntime);
runtimeManager.register(jsRuntime);
