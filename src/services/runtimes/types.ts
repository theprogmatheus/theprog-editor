import type { RunPlan, RuntimeId } from '../languages/types';

export type RuntimeStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface RuntimeProgress {
  status: RuntimeStatus;
  percent: number;
  doneBytes: number;
  totalBytes: number;
  message?: string;
  error?: string;
}

export type RuntimeProgressMap = Partial<Record<RuntimeId, RuntimeProgress>>;

export interface StdinController {
  sendStdin(line: string): void;
  abort(): void;
}

export interface SyncedFile {
  path: string;
  data: Uint8Array;
  isNew?: boolean;
}

export interface InstalledWheel {
  name: string;
  version: string;
  fileName: string;
  data: Uint8Array;
}

export interface RuntimeIO {
  /** Saída do programa (aba Execução). */
  onOutput(text: string): void;
  /** Mensagens de build/carregamento/avisos (aba Ambiente). */
  onEnvironmentOutput(text: string): void;
  /** Solicita alternância de aba do console. */
  onPhaseChange(phase: 'environment' | 'execution'): void;
  onNeedStdin(): void;
  onControllerReady(controller: StdinController): void;
  onFsSync?(files: SyncedFile[]): void;
  onMeta?(meta: { cached?: boolean }): void;
  /** Wheel baixada e instalada (para persistência offline). */
  onWheelInstalled?(wheel: InstalledWheel): void;
}

export interface RuntimeAdapter {
  id: RuntimeId;
  label: string;
  preload(): Promise<void>;
  run(plan: RunPlan, io: RuntimeIO): Promise<number>;
  terminate(): void;
  subscribeProgress(listener: (progress: RuntimeProgress) => void): () => void;
  getProgress(): RuntimeProgress;
}
