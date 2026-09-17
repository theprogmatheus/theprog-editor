import { commands } from '@yowasp/clang';
import { WASI, File, OpenFile, PreopenDirectory } from '@bjorn3/browser_wasi_shim';

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

export async function compileC(
  sources: string[],
  allFiles: Map<string, string>,
  outputBinaryName: string = 'main',
  onOutput: (text: string) => void
): Promise<Uint8Array | null> {
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
  };

  try {
    const wasmOutName = outputBinaryName.endsWith('.wasm') ? outputBinaryName : `${outputBinaryName}.wasm`;
    const args = ['-include', '__theprog_runtime.h', ...sources, '-o', wasmOutName];
    const resultFiles = await commands.clang(args, vfs, options);
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

  // Execução via Web Worker com SharedArrayBuffer e Atomics.wait para suporte interativo ao scanf
  if (typeof SharedArrayBuffer !== 'undefined' && typeof Worker !== 'undefined') {
    return new Promise((resolve) => {
      let isFinished = false;

      const worker = new Worker(new URL('../workers/wasmWorker.ts', import.meta.url), {
        type: 'module',
      });

      const sab = new SharedArrayBuffer(65536);
      const control = new Int32Array(sab, 0, 2);
      const data = new Uint8Array(sab, 8);

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
          const enc = new TextEncoder().encode(line);
          data.set(enc.subarray(0, 65520));
          Atomics.store(control, 1, Math.min(enc.length, 65520));
          Atomics.store(control, 0, 1); // 1 = INPUT_READY
          Atomics.notify(control, 0);
        },
        abort: () => {
          if (isFinished) return;
          Atomics.store(control, 0, -1); // -1 = ABORT
          Atomics.notify(control, 0);
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

  // Fallback caso SharedArrayBuffer não esteja disponível
  return runOnMainThread(binaryName, wasmBinary, onOutput);
}

async function runOnMainThread(
  binaryName: string,
  wasmBinary: Uint8Array,
  onOutput: (text: string) => void
): Promise<number> {
  try {
    class CaptureOutput extends OpenFile {
      constructor() {
        super(new File([]));
      }
      override fd_write(data: Uint8Array) {
        const text = new TextDecoder().decode(data);
        onOutput(text.replace(/\r?\n/g, '\r\n'));
        return { ret: 0, nwritten: data.byteLength };
      }
    }

    const fds = [
      new OpenFile(new File([])), // stdin
      new CaptureOutput(),        // stdout
      new CaptureOutput(),        // stderr
      new PreopenDirectory('.', new Map()),
    ];

    const wasi = new WASI([`./${binaryName}`], [], fds);
    const wasmModule = await WebAssembly.compile(wasmBinary.buffer as ArrayBuffer);
    const instance = await WebAssembly.instantiate(wasmModule, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    const exitCode = wasi.start(instance as any);
    return typeof exitCode === 'number' ? exitCode : 0;
  } catch (err: any) {
    onOutput(`\r\n\x1b[31mErro de execução: ${err?.message || err}\x1b[0m\r\n`);
    return 1;
  }
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
