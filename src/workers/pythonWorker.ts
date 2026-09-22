import {
  clearDirectory,
  extractModifiedOrNewFiles,
  type VirtualFileEntry,
} from './fsSync';

const BASE_URL = import.meta.env.BASE_URL;
const PYODIDE_DIR = `${BASE_URL}runtimes/pyodide/`;
const EXTRAS_DIR = `${BASE_URL}runtimes/pyodide-extras/`;

const decoder = new TextDecoder('utf-8');

const PYODIDE_ASM_FALLBACK_BYTES = 9_600_000;
const PYODIDE_STDLIB_FALLBACK_BYTES = 2_600_000;

interface WheelManifestEntry {
  name: string;
  version: string;
  fileName: string;
  source: string;
}

interface WheelManifest {
  pyodideVersion: string;
  packages: WheelManifestEntry[];
}

interface RunPayload {
  id: string;
  entry: string;
  files: { path: string; data: Uint8Array }[];
  args: string[];
  sabControl: SharedArrayBuffer;
  sabInterrupt: SharedArrayBuffer;
}

let pyodide: any = null;
let preloadPromise: Promise<void> | null = null;
let extrasManifest: WheelManifest | null = null;
let pyodideVersion = '';

let control: Int32Array | null = null;
let data: Uint8Array | null = null;

const knownWheels = new Set<string>();

function post(message: unknown, transfer?: Transferable[]): void {
  (self as unknown as { postMessage: (m: unknown, t?: Transferable[]) => void }).postMessage(
    message,
    transfer
  );
}

function postProgress(doneBytes: number, totalBytes: number): void {
  post({
    type: 'preload_progress',
    doneBytes,
    totalBytes,
    percent: totalBytes > 0 ? Math.min(100, Math.round((doneBytes / totalBytes) * 100)) : 0,
  });
}

async function installVendoredWheels(): Promise<void> {
  const response = await fetch(`${EXTRAS_DIR}manifest.json`);
  if (!response.ok) {
    throw new Error('Manifest de wheels vendorizadas indisponível');
  }
  extrasManifest = (await response.json()) as WheelManifest;
  const entries = [...extrasManifest.packages];
  entries.sort((a, b) => {
    if (a.name === 'micropip') return -1;
    if (b.name === 'micropip') return 1;
    if (a.name === 'black') return 1;
    if (b.name === 'black') return -1;
    return 0;
  });
  for (const entry of entries) {
    post({ type: 'preload_status', message: `Instalando ${entry.fileName}...` });
    await pyodide.loadPackage([`${EXTRAS_DIR}${entry.fileName}`]);
  }
}

function ensurePreloaded(): Promise<void> {
  if (pyodide) return Promise.resolve();
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      const wasmUrl = `${PYODIDE_DIR}pyodide.asm.wasm`;
      const stdlibUrl = `${PYODIDE_DIR}python_stdlib.zip`;

      let totalBytes = 0;
      let doneBytes = 0;
      const reportBytes = (bytes: number) => {
        doneBytes += bytes;
        postProgress(doneBytes, totalBytes);
      };

      post({ type: 'preload_status', message: 'Baixando runtime Python (Pyodide)...' });

      const wasmResponse = await fetch(wasmUrl);
      const wasmTotal = Number(wasmResponse.headers.get('content-length') || 0) || PYODIDE_ASM_FALLBACK_BYTES;
      totalBytes += wasmTotal;
      if (!wasmResponse.body) {
        await wasmResponse.arrayBuffer();
        reportBytes(wasmTotal);
      } else {
        const reader = wasmResponse.body.getReader();
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          reportBytes(chunk.value.length);
        }
      }

      const stdlibResponse = await fetch(stdlibUrl);
      const stdlibTotal =
        Number(stdlibResponse.headers.get('content-length') || 0) || PYODIDE_STDLIB_FALLBACK_BYTES;
      totalBytes += stdlibTotal;
      if (!stdlibResponse.body) {
        await stdlibResponse.arrayBuffer();
        reportBytes(stdlibTotal);
      } else {
        const reader = stdlibResponse.body.getReader();
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          reportBytes(chunk.value.length);
        }
      }

      post({ type: 'preload_status', message: 'Inicializando interpretador Python...' });

      const pyodideModule = await import(/* @vite-ignore */ `${PYODIDE_DIR}pyodide.mjs`);
      pyodideVersion = pyodideModule.version;

      pyodide = await pyodideModule.loadPyodide({
        indexURL: PYODIDE_DIR,
        packageBaseUrl: `https://cdn.jsdelivr.net/pyodide/v${pyodideModule.version}/full/`,
      });

      pyodide.setStdout({
        isatty: true,
        write: (buffer: Uint8Array) => {
          const text = decoder.decode(buffer, { stream: true });
          if (text) post({ type: 'stdout', text });
          return buffer.length;
        },
      });
      pyodide.setStderr({
        isatty: true,
        write: (buffer: Uint8Array) => {
          const text = decoder.decode(buffer, { stream: true });
          if (text) post({ type: 'stderr', text });
          return buffer.length;
        },
      });
      pyodide.setStdin({
        isatty: true,
        stdin: () => readBlockingLine(),
      });

      await installVendoredWheels();

      post({ type: 'preload_done', pyodideVersion: extrasManifest?.pyodideVersion || pyodideVersion });
    } catch (err: any) {
      pyodide = null;
      preloadPromise = null;
      post({ type: 'preload_error', error: err?.message || String(err) });
      throw err;
    }
  })();

  return preloadPromise;
}

function readBlockingLine(): string | null {
  if (!control || !data) return null;
  post({ type: 'stdin_need' });
  Atomics.wait(control, 0, 0);
  const status = Atomics.load(control, 0);
  if (status === -1) {
    return null;
  }
  if (status === 1) {
    const length = Atomics.load(control, 1);
    const received = new Uint8Array(length);
    received.set(data.subarray(0, length));
    Atomics.store(control, 0, 0);
    return decoder.decode(received);
  }
  return null;
}

function collectWorkspaceFiles(
  dir: string,
  relativePath: string,
  out: Map<string, VirtualFileEntry>
): void {
  const FS = pyodide.FS;
  for (const name of FS.readdir(dir)) {
    if (name === '.' || name === '..') continue;
    const fullPath = `${dir}/${name}`;
    const relPath = relativePath ? `${relativePath}/${name}` : name;
    const stat = FS.stat(fullPath);
    if (FS.isDir(stat.mode)) {
      const children = new Map<string, VirtualFileEntry>();
      collectWorkspaceFiles(fullPath, relPath, children);
      out.set(name, { data: new Uint8Array(0), children });
    } else {
      out.set(name, { data: FS.readFile(fullPath) });
    }
  }
}

async function runScript(payload: RunPayload): Promise<void> {
  const { id, entry, files, args, sabControl, sabInterrupt } = payload;

  try {
    await ensurePreloaded();

    control = new Int32Array(sabControl, 0, 2);
    data = new Uint8Array(sabControl, 8);
    pyodide.setInterruptBuffer(new Uint8Array(sabInterrupt));

    const FS = pyodide.FS;
    clearDirectory(FS, '/workspace');
    FS.mkdirTree('/workspace');

    const leftovers = FS.readdir('/workspace').filter(
      (name: string) => name !== '.' && name !== '..'
    );
    if (leftovers.length > 0) {
      throw new Error(
        `Não foi possível limpar o diretório de trabalho do Python: ${leftovers.join(', ')}`
      );
    }

    const originals = new Map<string, Uint8Array>();
    for (const file of files) {
      const cleanPath = file.path.replace(/^\.?\//, '').trim();
      if (!cleanPath) continue;
      const dir = cleanPath.includes('/') ? cleanPath.slice(0, cleanPath.lastIndexOf('/')) : '';
      if (dir) FS.mkdirTree(`/workspace/${dir}`);
      FS.writeFile(`/workspace/${cleanPath}`, file.data);
      originals.set(cleanPath, file.data);
    }

    pyodide.globals.set('__theprog_entry__', entry);
    pyodide.globals.set('__theprog_argv__', pyodide.toPy([entry, ...(args || [])]));

    let exitCode = 0;
    try {
      pyodide.runPython(`
import os
import runpy
import sys

sys.argv = list(__theprog_argv__)
sys.path.insert(0, '/workspace')
os.chdir('/workspace')
runpy.run_path(__theprog_entry__, run_name='__main__')
`);
    } catch (err: any) {
      const message = err?.message || String(err);
      if (/KeyboardInterrupt/.test(message)) {
        post({
          type: 'stderr',
          text: '\r\n\x1b[33m[Execução interrompida pelo usuário (Ctrl+C)]\x1b[0m\r\n',
        });
        exitCode = 130;
      } else {
        post({ type: 'stderr', text: `\r\n${message}\r\n` });
        exitCode = 1;
      }
    }

    const rootContents = new Map<string, VirtualFileEntry>();
    collectWorkspaceFiles('/workspace', '', rootContents);
    const modifiedFiles = extractModifiedOrNewFiles(rootContents, originals);
    if (modifiedFiles.length > 0) {
      post({ type: 'fs_sync', files: modifiedFiles });
    }

    post({ type: 'exit', id, code: exitCode });
  } catch (err: any) {
    post({ type: 'error', id, error: err?.message || String(err) });
  } finally {
    control = null;
    data = null;
  }
}

async function reportInstalledWheels(): Promise<void> {
  pyodide.runPython(`
import json
import micropip

try:
    __theprog_lock_json__ = json.dumps(micropip.freeze())
except Exception:
    __theprog_lock_json__ = '{}'
`);
  const lockJson = pyodide.globals.get('__theprog_lock_json__');
  let lock: { packages?: Record<string, { file_name?: string; version?: string }> } = {};
  try {
    lock = JSON.parse(lockJson || '{}');
  } catch {
    return;
  }
  const packages = lock.packages || {};
  for (const [name, info] of Object.entries(packages)) {
    const fileUrl = String(info.file_name || '');
    if (!fileUrl.startsWith('http')) continue;
    const fileName = fileUrl.split('/').pop() || '';
    if (!fileName || knownWheels.has(fileName)) continue;
    knownWheels.add(fileName);
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) continue;
      const buffer = new Uint8Array(await response.arrayBuffer());
      post(
        {
          type: 'wheel_installed',
          name,
          version: info.version || '',
          fileName,
          data: buffer,
        },
        [buffer.buffer]
      );
    } catch {
      // wheel permanece apenas no cache HTTP do navegador
    }
  }
}

async function installPackages(id: string, names: string[]): Promise<void> {
  try {
    await ensurePreloaded();
    const micropip = pyodide.pyimport('micropip');
    post({ type: 'packages_status', id, message: `Instalando ${names.join(', ')}...` });
    await micropip.install(names);
    micropip.destroy?.();
    post({ type: 'packages_status', id, message: 'Atualizando cache offline dos pacotes...' });
    await reportInstalledWheels();
    post({ type: 'packages_done', id });
  } catch (err: any) {
    post({ type: 'packages_error', id, error: err?.message || String(err) });
  }
}

async function restoreWheels(wheels: { fileName: string; data: Uint8Array }[]): Promise<void> {
  if (!wheels.length) return;
  try {
    await ensurePreloaded();
    const micropip = pyodide.pyimport('micropip');
    for (const wheel of wheels) {
      if (knownWheels.has(wheel.fileName)) continue;
      try {
        const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(wheel.data)]));
        await micropip.install(blobUrl);
        URL.revokeObjectURL(blobUrl);
        knownWheels.add(wheel.fileName);
      } catch {
        post({
          type: 'packages_status',
          message: `Aviso: não foi possível restaurar ${wheel.fileName} offline`,
        });
      }
    }
    micropip.destroy?.();
  } catch (err: any) {
    post({ type: 'packages_status', message: `Aviso: ${err?.message || String(err)}` });
  }
}

async function formatPython(id: string, code: string): Promise<void> {
  try {
    await ensurePreloaded();
    pyodide.globals.set('__theprog_fmt_code__', code);
    pyodide.runPython(`
import black

try:
    __theprog_fmt_result__ = black.format_str(__theprog_fmt_code__, mode=black.Mode())
    __theprog_fmt_error__ = None
except Exception as exc:
    __theprog_fmt_result__ = None
    __theprog_fmt_error__ = str(exc)
`);
    const error = pyodide.globals.get('__theprog_fmt_error__');
    if (error) {
      throw new Error(error);
    }
    const result = pyodide.globals.get('__theprog_fmt_result__');
    post({ type: 'format_result', id, code: result });
  } catch (err: any) {
    post({ type: 'format_error', id, error: err?.message || String(err) });
  }
}

self.onmessage = async (event: MessageEvent) => {
  const message = event.data;

  if (message.type === 'preload') {
    ensurePreloaded().catch(() => {
      // erro já reportado via preload_error
    });
    return;
  }

  if (message.type === 'run') {
    await runScript(message as RunPayload);
    return;
  }

  if (message.type === 'install_packages') {
    await installPackages(message.id, message.names || []);
    return;
  }

  if (message.type === 'restore_wheels') {
    await restoreWheels(message.wheels || []);
    return;
  }

  if (message.type === 'format') {
    await formatPython(message.id, message.code || '');
    return;
  }
};
