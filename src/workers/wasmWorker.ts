import { wasi, WASI, File, Directory, Inode, OpenFile, PreopenDirectory } from '@bjorn3/browser_wasi_shim';

interface InitialVfsFile {
  path: string;
  data: Uint8Array;
}

interface SyncedVfsFile {
  path: string;
  data: Uint8Array;
  isNew?: boolean;
}

function buildVfs(files: InitialVfsFile[] = []): Map<string, Inode> {
  const rootContents = new Map<string, Inode>();

  for (const file of files) {
    const cleanPath = file.path.replace(/^\.?\//, '').trim();
    if (!cleanPath) continue;

    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let currentDirMap = rootContents;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let entry = currentDirMap.get(part);
      if (!entry || !(entry instanceof Directory)) {
        const newDir = new Directory(new Map());
        currentDirMap.set(part, newDir);
        entry = newDir;
      }
      currentDirMap = (entry as Directory).contents;
    }

    const filename = parts[parts.length - 1];
    currentDirMap.set(filename, new File(file.data));
  }

  return rootContents;
}

function extractModifiedOrNewFiles(
  dirMap: Map<string, Inode>,
  originals: Map<string, Uint8Array>,
  currentPath = ''
): SyncedVfsFile[] {
  const result: SyncedVfsFile[] = [];

  for (const [name, inode] of dirMap.entries()) {
    const relPath = currentPath ? `${currentPath}/${name}` : name;
    if (inode instanceof File) {
      const orig = originals.get(relPath);
      let isModified = false;
      let isNew = false;

      if (!orig) {
        isModified = true;
        isNew = true;
      } else if (orig.length !== inode.data.length) {
        isModified = true;
      } else {
        for (let i = 0; i < orig.length; i++) {
          if (orig[i] !== inode.data[i]) {
            isModified = true;
            break;
          }
        }
      }

      if (isModified) {
        result.push({
          path: relPath,
          data: inode.data,
          isNew,
        });
      }
    } else if (inode instanceof Directory) {
      result.push(...extractModifiedOrNewFiles(inode.contents, originals, relPath));
    }
  }

  return result;
}

self.onmessage = async (event: MessageEvent) => {
  const { wasmBinary, sab, binaryName, initialFiles } = event.data;

  const hasSab = Boolean(sab && typeof SharedArrayBuffer !== 'undefined' && sab instanceof SharedArrayBuffer);
  const control = hasSab && sab ? new Int32Array(sab, 0, 2) : null;
  const data = hasSab && sab ? new Uint8Array(sab, 8) : null;

  class WorkerStdin extends OpenFile {
    private buffer: Uint8Array = new Uint8Array(0);
    private pos: number = 0;

    constructor() {
      super(new File([]));
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
          this.pos = chunk.length;
          return { ret: 0, data: chunk };
        }

        return { ret: 0, data: new Uint8Array(0) };
      }

      // Ambiente sem suporte a SharedArrayBuffer no navegador
      self.postMessage({
        type: 'stdout',
        text: '\r\n\x1b[33m[Aviso: Entrada interativa (scanf/cin)]\x1b[0m\r\n\x1b[90mPara executar programas com entrada de dados interativa no terminal, acesse o TheProg Editor pelo endereço oficial:\x1b[0m\r\n\x1b[36m👉 https://matheus.eti.br/theprog-editor\x1b[0m\r\n\x1b[90mOu instale o aplicativo (PWA) no seu dispositivo para compatibilidade total.\x1b[0m\r\n',
      });
      return { ret: 0, data: new Uint8Array(0) };
    }
  }

  class WorkerStdout extends OpenFile {
    private decoder = new TextDecoder('utf-8');

    constructor() {
      super(new File([]));
    }

    override fd_fdstat_get() {
      return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_CHARACTER_DEVICE, 0) };
    }

    override fd_write(bytes: Uint8Array) {
      const text = this.decoder.decode(bytes, { stream: true });
      if (text.length > 0) {
        self.postMessage({ type: 'stdout', text });
      }
      return { ret: 0, nwritten: bytes.byteLength };
    }

    public flush() {
      const text = this.decoder.decode();
      if (text.length > 0) {
        self.postMessage({ type: 'stdout', text });
      }
    }
  }

  try {
    const rawFiles: InitialVfsFile[] = Array.isArray(initialFiles) ? initialFiles : [];
    const originalFilesMap = new Map<string, Uint8Array>();
    for (const f of rawFiles) {
      const cleanPath = f.path.replace(/^\.?\//, '').trim();
      if (cleanPath) {
        originalFilesMap.set(cleanPath, f.data);
      }
    }

    const rootContents = buildVfs(rawFiles);
    const stdout = new WorkerStdout();
    const stderr = new WorkerStdout();

    const fds = [
      new WorkerStdin(),
      stdout,
      stderr,
      new PreopenDirectory('.', rootContents),
    ];

    const wasi = new WASI([`./${binaryName}`], [], fds);
    const wasmModule = await WebAssembly.compile(wasmBinary);
    const instance = await WebAssembly.instantiate(wasmModule, {
      wasi_snapshot_preview1: wasi.wasiImport,
    });

    const exitCode = wasi.start(instance as any);
    stdout.flush();
    stderr.flush();

    // Extrai arquivos criados ou modificados durante a execução do programa
    const modifiedFiles = extractModifiedOrNewFiles(rootContents, originalFilesMap);
    if (modifiedFiles.length > 0) {
      self.postMessage({ type: 'fs_sync', files: modifiedFiles });
    }

    self.postMessage({ type: 'exit', code: typeof exitCode === 'number' ? exitCode : 0 });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err?.message || String(err) });
  }
};
