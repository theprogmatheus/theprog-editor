import { commands } from '@yowasp/clang';

interface CompileRequest {
  type: 'compile';
  id: string;
  sources: string[];
  vfs: Record<string, string>;
  isCpp: boolean;
  extraArgs: string[];
  outputBinaryName: string;
}

interface PreloadRequest {
  type: 'preload';
}

type WorkerRequest = CompileRequest | PreloadRequest;

const stdoutDecoder = new TextDecoder('utf-8');
const stderrDecoder = new TextDecoder('utf-8');

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;

  if (req.type === 'preload') {
    try {
      await commands.clang(undefined, {}, {
        fetchProgress: ({ doneLength, totalLength }: { doneLength: number; totalLength: number }) => {
          const percent = totalLength > 0 ? Math.min(100, Math.round((doneLength / totalLength) * 100)) : 0;
          self.postMessage({
            type: 'preload_progress',
            percent,
            doneBytes: doneLength,
            totalBytes: totalLength,
          });
        },
      });
      self.postMessage({ type: 'preload_done' });
    } catch (err: any) {
      self.postMessage({ type: 'preload_error', error: err?.message || String(err) });
    }
    return;
  }

  if (req.type === 'compile') {
    const { id, sources, vfs, isCpp, extraArgs, outputBinaryName } = req;
    const wasmOutName = outputBinaryName.endsWith('.wasm') ? outputBinaryName : `${outputBinaryName}.wasm`;

    const cleanExtraArgs = extraArgs.map((a) => a.trim()).filter(Boolean);
    // Flags otimizadas para compilação fluida e rápida:
    // -O0: compilação rápida em tempo de desenvolvimento
    // -Wl,--gc-sections: elimina seções não utilizadas da libstdc++/libc, reduzindo drasticamente o tamanho do binário e tempo de linkagem
    const defaultFlags = isCpp
      ? ['-O0', '-Wl,--gc-sections']
      : ['-O0', '-Wl,--gc-sections'];

    const args = [
      '-include',
      '__theprog_runtime.h',
      ...defaultFlags,
      ...cleanExtraArgs,
      ...sources,
      '-o',
      wasmOutName,
    ];

    const options = {
      stdout: (bytes: Uint8Array | null) => {
        if (bytes) {
          const text = stdoutDecoder.decode(bytes, { stream: true });
          if (text) {
            self.postMessage({ type: 'stdout', id, text });
          }
        }
      },
      stderr: (bytes: Uint8Array | null) => {
        if (bytes) {
          const text = stderrDecoder.decode(bytes, { stream: true });
          if (text) {
            self.postMessage({ type: 'stderr', id, text });
          }
        }
      },
      fetchProgress: () => {},
    };

    try {
      const compileCommand = isCpp ? commands['clang++'] : commands.clang;
      const resultFiles = await compileCommand(args, vfs, options);
      const wasmBinary = resultFiles ? (resultFiles[wasmOutName] as Uint8Array | undefined) : undefined;

      if (!wasmBinary) {
        self.postMessage({ type: 'compile_failed', id });
        return;
      }

      // Transferência zero-copy do ArrayBuffer do binário para a thread principal
      self.postMessage({ type: 'compile_success', id, wasmBinary }, [wasmBinary.buffer]);
    } catch (err: any) {
      self.postMessage({ type: 'compile_error', id, error: err?.message || String(err) });
    }
  }
};
