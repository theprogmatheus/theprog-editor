import { wasi, WASI, File, OpenFile, PreopenDirectory } from '@bjorn3/browser_wasi_shim';

self.onmessage = async (event: MessageEvent) => {
  const { wasmBinary, sab, binaryName, initialStdin } = event.data;

  const hasSab = Boolean(sab && typeof SharedArrayBuffer !== 'undefined' && sab instanceof SharedArrayBuffer);
  const control = hasSab && sab ? new Int32Array(sab, 0, 2) : null;
  const data = hasSab && sab ? new Uint8Array(sab, 8) : null;

  class WorkerStdin extends OpenFile {
    private buffer: Uint8Array = new Uint8Array(0);
    private pos: number = 0;

    constructor(initialInput?: string) {
      super(new File([]));
      if (initialInput && initialInput.length > 0) {
        const text = initialInput.endsWith('\n') ? initialInput : initialInput + '\n';
        this.buffer = new TextEncoder().encode(text);
      }
    }

    override fd_fdstat_get() {
      return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_CHARACTER_DEVICE, 0) };
    }

    override fd_read(size: number) {
      if (this.pos < this.buffer.length) {
        const chunk = this.buffer.slice(this.pos, this.pos + size);
        this.pos += chunk.length;
        return { ret: 0, data: chunk };
      }

      // Se temos SharedArrayBuffer e Atomics, pausamos sincronicamente a thread do worker:
      if (hasSab && control && data) {
        // Buffer está vazio: avisa a thread principal para receber digitação do usuário
        self.postMessage({ type: 'stdin_need' });

        // Pausa sincronicamente até a thread principal gravar e notificar
        Atomics.wait(control, 0, 0);

        const status = Atomics.load(control, 0);
        if (status === -1) {
          // Interrompido por Ctrl+C
          return { ret: 0, data: new Uint8Array(0) };
        }

        if (status === 1) {
          const len = Atomics.load(control, 1);
          const received = new Uint8Array(len);
          received.set(data.subarray(0, len));
          Atomics.store(control, 0, 0);

          this.buffer = received;
          this.pos = 0;

          const chunk = this.buffer.slice(0, size);
          this.pos += chunk.length;
          return { ret: 0, data: chunk };
        }

        return { ret: 0, data: new Uint8Array(0) };
      }

      // Buffer pré-carregado esgotado e sem SharedArrayBuffer: retorna EOF (fim de arquivo)
      return { ret: 0, data: new Uint8Array(0) };
    }
  }

  class WorkerStdout extends OpenFile {
    constructor() {
      super(new File([]));
    }

    override fd_fdstat_get() {
      return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_CHARACTER_DEVICE, 0) };
    }

    override fd_write(bytes: Uint8Array) {
      const text = new TextDecoder().decode(bytes);
      self.postMessage({ type: 'stdout', text });
      return { ret: 0, nwritten: bytes.byteLength };
    }
  }

  try {
    const fds = [
      new WorkerStdin(initialStdin),
      new WorkerStdout(),
      new WorkerStdout(),
      new PreopenDirectory('.', new Map()),
    ];

    const wasi = new WASI([`./${binaryName}`], [], fds);
    const wasmModule = await WebAssembly.compile(wasmBinary);
    const instance = await WebAssembly.instantiate(wasmModule, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    const exitCode = wasi.start(instance as any);
    self.postMessage({ type: 'exit', code: typeof exitCode === 'number' ? exitCode : 0 });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err?.message || String(err) });
  }
};
