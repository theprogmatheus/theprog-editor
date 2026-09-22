const THEPROG_RUNTIME_HEADER = `
#ifndef __THEPROG_RUNTIME_H
#define __THEPROG_RUNTIME_H

#include <stdio.h>
#include <stdlib.h>

#ifdef __cplusplus
extern "C" {
#endif

__attribute__((constructor))
static void __theprog_init_stdio(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stderr, NULL, _IONBF, 0);
}

#ifdef __cplusplus
// Stubs para exceções em WebAssembly WASI (evitam erro de símbolo indefinido no wasm-ld)
void* __cxa_allocate_exception(size_t size) throw() {
    return malloc(size);
}
void __cxa_free_exception(void* ptr) throw() {
    free(ptr);
}
void __cxa_throw(void* ptr, void* tinfo, void (*dest)(void*)) {
    fprintf(stderr, "\\n\\x1b[31m[Exceção C++ não capturada disparada pelo programa]\\x1b[0m\\n");
    exit(1);
}
}
#endif

#endif
`;

export type CompilerStatus = 'unloaded' | 'preloading' | 'ready' | 'error';

export interface CompilerProgress {
  status: CompilerStatus;
  percent: number;
  doneBytes: number;
  totalBytes: number;
  error?: string;
}

let currentProgress: CompilerProgress = {
  status: 'unloaded',
  percent: 0,
  doneBytes: 0,
  totalBytes: 0,
};

type ProgressListener = (progress: CompilerProgress) => void;
const progressListeners = new Set<ProgressListener>();

function notifyProgress() {
  progressListeners.forEach((listener) => {
    try {
      listener(currentProgress);
    } catch (e) {
      console.warn('Erro no listener de progresso do compilador:', e);
    }
  });
}

export function subscribeCompilerProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  listener(currentProgress);
  return () => progressListeners.delete(listener);
}

export function getCompilerProgress(): CompilerProgress {
  return currentProgress;
}

// Web Worker dedicado de compilação Clang
let activeCompilerWorker: Worker | null = null;
let pendingCompileResolve: ((value: Uint8Array | null) => void) | null = null;
let currentCompileOutput: ((text: string) => void) | null = null;
let currentCompileId: string = '';

function getCompilerWorker(): Worker {
  if (!activeCompilerWorker) {
    activeCompilerWorker = new Worker(
      new URL('../workers/compilerWorker.ts', import.meta.url),
      { type: 'module' }
    );

    activeCompilerWorker.onmessage = (event: MessageEvent) => {
      const msg = event.data;

      if (msg.type === 'preload_progress') {
        currentProgress = {
          status: msg.percent >= 100 ? 'ready' : 'preloading',
          percent: msg.percent,
          doneBytes: msg.doneBytes,
          totalBytes: msg.totalBytes,
        };
        notifyProgress();
        return;
      }

      if (msg.type === 'preload_done') {
        currentProgress = {
          status: 'ready',
          percent: 100,
          doneBytes: currentProgress.totalBytes || 105241285,
          totalBytes: currentProgress.totalBytes || 105241285,
        };
        notifyProgress();
        return;
      }

      if (msg.type === 'preload_error') {
        currentProgress = {
          status: 'error',
          percent: 0,
          doneBytes: 0,
          totalBytes: 0,
          error: msg.error,
        };
        notifyProgress();
        return;
      }

      // Mensagens de compilação
      if (msg.id && msg.id !== currentCompileId) return;

      if (msg.type === 'stdout' || msg.type === 'stderr') {
        if (currentCompileOutput) {
          currentCompileOutput(msg.text.replace(/\r?\n/g, '\r\n'));
        }
      } else if (msg.type === 'compile_success') {
        if (pendingCompileResolve) {
          const res = pendingCompileResolve;
          pendingCompileResolve = null;
          res(msg.wasmBinary);
        }
      } else if (msg.type === 'compile_failed' || msg.type === 'compile_error') {
        if (msg.error && currentCompileOutput) {
          currentCompileOutput(`\r\n\x1b[31m${msg.error}\x1b[0m\r\n`);
        }
        if (pendingCompileResolve) {
          const res = pendingCompileResolve;
          pendingCompileResolve = null;
          res(null);
        }
      }
    };

    activeCompilerWorker.onerror = (err) => {
      console.error('Erro no compilerWorker:', err);
      if (currentCompileOutput) {
        currentCompileOutput(`\r\n\x1b[31m[Erro no processo de compilação em background: ${err?.message || err}]\x1b[0m\r\n`);
      }
      if (pendingCompileResolve) {
        const res = pendingCompileResolve;
        pendingCompileResolve = null;
        res(null);
      }
    };
  }
  return activeCompilerWorker;
}

/**
 * Interrompe o processo de compilação imediatamente terminando o Web Worker.
 */
export function terminateCompilerWorker(): void {
  if (pendingCompileResolve) {
    const res = pendingCompileResolve;
    pendingCompileResolve = null;
    res(null);
  }
  currentCompileOutput = null;
  currentCompileId = '';

  if (activeCompilerWorker) {
    try {
      activeCompilerWorker.terminate();
    } catch {}
    activeCompilerWorker = null;
  }
}

let preloadPromise: Promise<void> | null = null;

/**
 * Pré-carrega o LLVM Clang WebAssembly e a biblioteca padrão C/C++ em segundo plano (em Web Worker).
 */
export function preloadCompiler(): Promise<void> {
  if (currentProgress.status === 'ready') {
    return Promise.resolve();
  }

  if (preloadPromise) {
    return preloadPromise;
  }

  currentProgress = {
    ...currentProgress,
    status: 'preloading',
  };
  notifyProgress();

  preloadPromise = new Promise<void>((resolve, reject) => {
    const worker = getCompilerWorker();

    const unsubscribe = subscribeCompilerProgress((prog) => {
      if (prog.status === 'ready') {
        unsubscribe();
        resolve();
      } else if (prog.status === 'error') {
        unsubscribe();
        preloadPromise = null;
        reject(new Error(prog.error || 'Falha no pré-carregamento'));
      }
    });

    worker.postMessage({ type: 'preload' });
  });

  return preloadPromise;
}

// Cache em memória de binários compilados (Zero-Delay Re-run)
const compilationCache = new Map<string, { wasmBinary: Uint8Array; timestamp: number }>();

function computeCompilationHash(
  sources: string[],
  allFiles: Map<string, string>,
  extraArgs: string[]
): string {
  let str = extraArgs.join(' ') + '||';
  sources.forEach((s) => {
    str += `${s}:${allFiles.get(s) || ''}||`;
  });
  allFiles.forEach((content, name) => {
    if (name.endsWith('.h') || name.endsWith('.hpp')) {
      str += `${name}:${content}||`;
    }
  });

  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function clearCompilationCache(): void {
  compilationCache.clear();
}

export interface CompileResult {
  wasmBinary: Uint8Array | null;
  wasCached: boolean;
}

/**
 * Compila o código C ou C++ em segundo plano utilizando um Web Worker dedicado.
 * A thread principal da interface (UI) NUNCA é congelada.
 */
export async function compileC(
  sources: string[],
  allFiles: Map<string, string>,
  outputBinaryName: string = 'main',
  onOutput: (text: string) => void,
  extraArgs: string[] = []
): Promise<CompileResult> {
  // 1. Verificação de Cache: se o código não mudou desde a última compilação bem-sucedida, retorna em 0ms
  const cacheKey = computeCompilationHash(sources, allFiles, extraArgs);
  const cached = compilationCache.get(cacheKey);
  if (cached && cached.wasmBinary) {
    return {
      wasmBinary: cached.wasmBinary.slice(),
      wasCached: true,
    };
  }

  // 2. Se o compilador ainda estiver inicializando seus arquivos base:
  if (currentProgress.status !== 'ready') {
    onOutput('\x1b[36m[TheProg] Inicializando ambiente C/C++ WebAssembly em background...\x1b[0m\r\n');
    let lastReported = -1;
    const unsubscribe = subscribeCompilerProgress((prog) => {
      if (prog.status === 'preloading' && prog.percent !== lastReported) {
        lastReported = prog.percent;
        const mbDone = (prog.doneBytes / (1024 * 1024)).toFixed(1);
        const mbTotal = (prog.totalBytes / (1024 * 1024)).toFixed(1);
        onOutput(`\r\x1b[K\x1b[33mCarregando recursos do Clang: ${prog.percent}% (${mbDone} MB / ${mbTotal} MB)...\x1b[0m`);
      }
    });

    try {
      await preloadCompiler();
      onOutput('\r\x1b[K\x1b[32mCompilador pronto!\x1b[0m\r\n');
    } catch (preloadErr: any) {
      onOutput(`\r\x1b[K\x1b[31mErro ao inicializar compilador: ${preloadErr?.message || preloadErr}\x1b[0m\r\n`);
      return { wasmBinary: null, wasCached: false };
    } finally {
      unsubscribe();
    }
  }

  // 3. Monta o VFS com o runtime header do TheProg
  const vfs: Record<string, string> = {
    '__theprog_runtime.h': THEPROG_RUNTIME_HEADER,
  };
  allFiles.forEach((content, name) => {
    vfs[name] = content;
  });

  const isCpp = sources.some((s) => {
    const lower = s.toLowerCase();
    return lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx') || lower.endsWith('.hpp');
  });

  const compileId = 'compile-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  currentCompileId = compileId;
  currentCompileOutput = onOutput;

  const worker = getCompilerWorker();

  return new Promise<CompileResult>((resolve) => {
    pendingCompileResolve = (wasmBinary) => {
      if (wasmBinary) {
        // Armazena no cache para execuções subsequentes imediatas
        compilationCache.set(cacheKey, {
          wasmBinary: wasmBinary.slice(),
          timestamp: Date.now(),
        });
        resolve({ wasmBinary, wasCached: false });
      } else {
        resolve({ wasmBinary: null, wasCached: false });
      }
    };

    worker.postMessage({
      type: 'compile',
      id: compileId,
      sources,
      vfs,
      isCpp,
      extraArgs,
      outputBinaryName,
    });
  });
}

export interface ExecutionCallbacks {
  onOutput: (text: string) => void;
  onNeedStdin?: () => void;
  onControllerReady?: (controller: { sendStdin: (line: string) => void; abort: () => void }) => void;
  vfsFiles?: { path: string; data: Uint8Array }[];
  onFsSync?: (files: { path: string; data: Uint8Array; isNew?: boolean }[]) => void;
}

export async function executeWasmBinary(
  binaryName: string,
  wasmBinary: Uint8Array,
  callbacks: ((text: string) => void) | ExecutionCallbacks
): Promise<number> {
  const onOutput = typeof callbacks === 'function' ? callbacks : callbacks.onOutput;
  const onNeedStdin = typeof callbacks === 'function' ? undefined : callbacks.onNeedStdin;
  const onControllerReady = typeof callbacks === 'function' ? undefined : callbacks.onControllerReady;
  const vfsFiles = typeof callbacks === 'function' ? undefined : callbacks.vfsFiles;
  const onFsSync = typeof callbacks === 'function' ? undefined : callbacks.onFsSync;

  return new Promise((resolve) => {
    let isFinished = false;

    // SEMPRE executa dentro de Web Worker isolado em background!
    // NUNCA executa WASM na thread principal (UI thread), garantindo que loops infinitos
    // (ex: while(1)) jamais travem a aba do navegador e possam ser interrompidos pelo usuário (Ctrl+C).
    const worker = new Worker(new URL('../workers/wasmWorker.ts', import.meta.url), {
      type: 'module',
    });

    const hasSab = typeof SharedArrayBuffer !== 'undefined';
    let sab: SharedArrayBuffer | undefined;
    let control: Int32Array | undefined;
    let data: Uint8Array | undefined;

    if (hasSab) {
      sab = new SharedArrayBuffer(65536);
      control = new Int32Array(sab, 0, 2);
      data = new Uint8Array(sab, 8);
    }

    const cleanup = () => {
      if (!isFinished) {
        isFinished = true;
        try {
          worker.terminate();
        } catch {
          // ignore
        }
      }
    };

    const controller = {
      sendStdin: (line: string) => {
        if (isFinished) return;
        if (hasSab && control && data) {
          const enc = new TextEncoder().encode(line);
          data.set(enc.subarray(0, 65520));
          Atomics.store(control, 1, Math.min(enc.length, 65520));
          Atomics.store(control, 0, 1); // 1 = INPUT_READY
          Atomics.notify(control, 0);
        }
      },
      abort: () => {
        if (isFinished) return;
        if (hasSab && control) {
          Atomics.store(control, 0, -1); // -1 = ABORT
          Atomics.notify(control, 0);
        }
        cleanup();
      },
    };

    if (onControllerReady) {
      onControllerReady(controller);
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'stdout') {
        onOutput(msg.text.replace(/\r?\n/g, '\r\n'));
      } else if (msg.type === 'stdin_need') {
        if (onNeedStdin) onNeedStdin();
      } else if (msg.type === 'fs_sync') {
        if (onFsSync) onFsSync(msg.files);
      } else if (msg.type === 'exit') {
        cleanup();
        resolve(typeof msg.code === 'number' ? msg.code : 0);
      } else if (msg.type === 'error') {
        onOutput(`\r\n\x1b[31mErro de execução: ${msg.error}\x1b[0m\r\n`);
        cleanup();
        resolve(1);
      }
    };

    worker.onerror = (err) => {
      onOutput(`\r\n\x1b[31mErro no worker: ${err?.message || 'Falha na execução'}\x1b[0m\r\n`);
      cleanup();
      resolve(1);
    };

    worker.postMessage({ wasmBinary, sab, binaryName, initialFiles: vfsFiles || [] });
  });
}

export async function compileAndExecuteC(
  sources: string[],
  allFiles: Map<string, string>,
  onOutput: (text: string) => void,
  binaryName: string = 'main'
): Promise<boolean> {
  const { wasmBinary } = await compileC(sources, allFiles, binaryName, onOutput);
  if (!wasmBinary) return false;
  const exitCode = await executeWasmBinary(binaryName, wasmBinary, onOutput);
  return exitCode === 0;
}
