import { commands } from '@yowasp/clang';

const THEPROG_RUNTIME_HEADER = `
#ifndef __THEPROG_RUNTIME_H
#define __THEPROG_RUNTIME_H

#include <stdio.h>

__attribute__((constructor))
static void __theprog_init_stdio(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stderr, NULL, _IONBF, 0);
}

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

let preloadPromise: Promise<void> | null = null;

/**
 * Pré-carrega o LLVM Clang WebAssembly e a biblioteca padrão C/C++ em segundo plano.
 * Ao ser chamado no boot da aplicação, o usuário encontra o compilador 100% pronto
 * na memória para compilar qualquer código instantaneamente no clique de "Executar".
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

  preloadPromise = (async () => {
    try {
      // Chamar clang com args = undefined aciona o pré-carregamento de recursos do runtime sem compilar arquivo
      await commands.clang(undefined, {}, {
        fetchProgress: ({ doneLength, totalLength }: { doneLength: number; totalLength: number }) => {
          const percent = totalLength > 0 ? Math.min(100, Math.round((doneLength / totalLength) * 100)) : 0;
          currentProgress = {
            status: percent >= 100 ? 'ready' : 'preloading',
            percent,
            doneBytes: doneLength,
            totalBytes: totalLength,
          };
          notifyProgress();
        },
      });

      currentProgress = {
        status: 'ready',
        percent: 100,
        doneBytes: currentProgress.totalBytes || 105241285,
        totalBytes: currentProgress.totalBytes || 105241285,
      };
      notifyProgress();
    } catch (err: any) {
      console.warn('Falha no pré-carregamento do Clang:', err);
      currentProgress = {
        ...currentProgress,
        status: 'error',
        error: err?.message || String(err),
      };
      notifyProgress();
      preloadPromise = null;
      throw err;
    }
  })();

  return preloadPromise;
}

export async function compileC(
  sources: string[],
  allFiles: Map<string, string>,
  outputBinaryName: string = 'main',
  onOutput: (text: string) => void,
  extraArgs: string[] = []
): Promise<Uint8Array | null> {
  // Se ainda estiver pré-carregando quando o usuário clicou em Executar, exibe feedback visual amigável
  if (currentProgress.status !== 'ready') {
    onOutput('\x1b[36m[TheProg] Inicializando compilador C/C++ WebAssembly...\x1b[0m\r\n');
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
      return null;
    } finally {
      unsubscribe();
    }
  }

  const vfs: Record<string, string> = {
    '__theprog_runtime.h': THEPROG_RUNTIME_HEADER,
  };
  allFiles.forEach((content, name) => {
    vfs[name] = content;
  });

  let compilerStderr = '';
  let compilerStdout = '';

  const options = {
    stdout: (bytes: Uint8Array | null) => {
      if (bytes) {
        const text = new TextDecoder().decode(bytes);
        compilerStdout += text;
        onOutput(text.replace(/\r?\n/g, '\r\n'));
      }
    },
    stderr: (bytes: Uint8Array | null) => {
      if (bytes) {
        const text = new TextDecoder().decode(bytes);
        compilerStderr += text;
        onOutput(text.replace(/\r?\n/g, '\r\n'));
      }
    },
    // Suprime o console.log bruto do YoWASP no console
    fetchProgress: () => {},
  };

  try {
    const wasmOutName = outputBinaryName.endsWith('.wasm') ? outputBinaryName : `${outputBinaryName}.wasm`;
    const cleanExtraArgs = extraArgs.map((a) => a.trim()).filter(Boolean);
    const args = ['-include', '__theprog_runtime.h', ...cleanExtraArgs, ...sources, '-o', wasmOutName];

    // Detecta se algum dos arquivos de entrada é C++ para vincular a libstdc++ corretamente
    const isCpp = sources.some((s) => {
      const lower = s.toLowerCase();
      return lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx');
    });

    const compileCommand = isCpp ? commands['clang++'] : commands.clang;
    const resultFiles = await compileCommand(args, vfs, options);
    const wasmBinary = resultFiles ? (resultFiles[wasmOutName] as Uint8Array | undefined) : undefined;

    if (!wasmBinary) {
      if (!compilerStderr) {
        onOutput('\r\n\x1b[31merror: Falha na compilação.\x1b[0m\r\n');
      }
      return null;
    }

    return wasmBinary;
  } catch (err: any) {
    if (!compilerStderr) {
      onOutput(`\r\n\x1b[31m${err?.message || err}\x1b[0m\r\n`);
    }
    return null;
  }
}


export interface ExecutionCallbacks {
  onOutput: (text: string) => void;
  onNeedStdin?: () => void;
  onControllerReady?: (controller: { sendStdin: (line: string) => void; abort: () => void }) => void;
}

export async function executeWasmBinary(
  binaryName: string,
  wasmBinary: Uint8Array,
  callbacks: ((text: string) => void) | ExecutionCallbacks
): Promise<number> {
  const onOutput = typeof callbacks === 'function' ? callbacks : callbacks.onOutput;
  const onNeedStdin = typeof callbacks === 'function' ? undefined : callbacks.onNeedStdin;
  const onControllerReady = typeof callbacks === 'function' ? undefined : callbacks.onControllerReady;

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
        } catch (e) {
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

    worker.postMessage({ wasmBinary, sab, binaryName });
  });
}


export async function compileAndExecuteC(
  sources: string[],
  allFiles: Map<string, string>,
  onOutput: (text: string) => void,
  binaryName: string = 'main'
): Promise<boolean> {
  const wasmBinary = await compileC(sources, allFiles, binaryName, onOutput);
  if (!wasmBinary) return false;
  const exitCode = await executeWasmBinary(binaryName, wasmBinary, onOutput);
  return exitCode === 0;
}
