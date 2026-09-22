import { describe, expect, it } from 'vitest';
import {
  clearDirectory,
  extractModifiedOrNewFiles,
  type MinimalFileSystem,
  type VirtualFileEntry,
} from './fsSync';

const DIR_MODE = 0o040755;
const FILE_MODE = 0o100644;

/**
 * Mock de FS estilo Emscripten com a característica que causou o bug real:
 * `rmdir` NÃO é recursivo (lança ENOTEMPTY quando o diretório tem conteúdo).
 */
class MockFs implements MinimalFileSystem {
  private files = new Map<string, Uint8Array>();
  private dirs = new Set<string>();

  constructor(initial: Record<string, string> = {}) {
    this.dirs.add('/');
    for (const [path, content] of Object.entries(initial)) {
      this.writeFile(path, content);
    }
  }

  writeFile(path: string, content: string): void {
    this.ensureDir(path.slice(0, path.lastIndexOf('/')) || '/');
    this.files.set(path, new TextEncoder().encode(content));
  }

  mkdirp(path: string): void {
    this.ensureDir(path);
  }

  private ensureDir(path: string): void {
    if (!path || path === '/') {
      this.dirs.add('/');
      return;
    }
    const parent = path.slice(0, path.lastIndexOf('/')) || '/';
    this.ensureDir(parent);
    this.dirs.add(path);
  }

  readdir(path: string): string[] {
    if (!this.dirs.has(path)) {
      throw new Error('ENOENT');
    }
    const prefix = path === '/' ? '/' : `${path}/`;
    const names = new Set<string>();
    for (const entry of [...this.files.keys(), ...this.dirs]) {
      if (!entry.startsWith(prefix)) continue;
      const rest = entry.slice(prefix.length);
      if (!rest) continue;
      names.add(rest.split('/')[0]);
    }
    return ['.', '..', ...names];
  }

  stat(path: string): { mode: number } {
    if (this.dirs.has(path)) return { mode: DIR_MODE };
    if (this.files.has(path)) return { mode: FILE_MODE };
    throw new Error('ENOENT');
  }

  isDir(mode: number): boolean {
    return (mode & 0o170000) === 0o040000;
  }

  unlink(path: string): void {
    if (!this.files.delete(path)) throw new Error('ENOENT');
  }

  rmdir(path: string): void {
    if (!this.dirs.has(path)) throw new Error('ENOENT');
    const prefix = `${path}/`;
    for (const entry of [...this.files.keys(), ...this.dirs]) {
      if (entry.startsWith(prefix)) {
        throw new Error('ENOTEMPTY (errno 55)');
      }
    }
    this.dirs.delete(path);
  }

  listFiles(): string[] {
    return [...this.files.keys()].sort();
  }

  listDirs(): string[] {
    return [...this.dirs].sort();
  }
}

describe('clearDirectory', () => {
  it('remove recursivamente arquivos e subdiretórios (rmdir não-recursivo)', () => {
    const fs = new MockFs({
      '/workspace/main.c': 'int main() {}',
      '/workspace/main.py': 'print("sandbox")',
      '/workspace/sub/script.py': 'print("sub")',
      '/workspace/sub/deep/data.txt': 'dados',
    });

    clearDirectory(fs, '/workspace');

    expect(fs.listFiles().filter((p) => p.startsWith('/workspace'))).toEqual([]);
    expect(fs.listDirs().filter((p) => p !== '/workspace' && p.startsWith('/workspace'))).toEqual([]);
    expect(fs.stat('/workspace')).toEqual({ mode: DIR_MODE });
  });

  it('é um no-op quando o diretório não existe', () => {
    const fs = new MockFs();
    expect(() => clearDirectory(fs, '/workspace')).not.toThrow();
  });

  it('garante que nenhum resíduo de execuções anteriores sobreviva', () => {
    const fs = new MockFs({
      '/workspace/main.c': 'int main() {}',
      '/workspace/main.py': 'print("sandbox")',
    });

    clearDirectory(fs, '/workspace');
    fs.writeFile('/workspace/script_local.py', 'print("local")');

    const remaining = fs
      .readdir('/workspace')
      .filter((name) => name !== '.' && name !== '..');
    expect(remaining).toEqual(['script_local.py']);
  });
});

describe('extractModifiedOrNewFiles', () => {
  it('detecta arquivos novos, modificados e inalterados', () => {
    const original = new TextEncoder().encode('print("original")');
    const originals = new Map<string, Uint8Array>([['main.py', original]]);

    const tree = new Map<string, VirtualFileEntry>([
      ['main.py', { data: new TextEncoder().encode('print("modificado")') }],
      ['novo.txt', { data: new TextEncoder().encode('novo') }],
    ]);

    const result = extractModifiedOrNewFiles(tree, originals);
    expect(result.map((f) => f.path).sort()).toEqual(['main.py', 'novo.txt']);
    expect(result.find((f) => f.path === 'novo.txt')?.isNew).toBe(true);
    expect(result.find((f) => f.path === 'main.py')?.isNew).toBe(false);
  });

  it('ignora arquivos inalterados', () => {
    const original = new TextEncoder().encode('print("igual")');
    const originals = new Map<string, Uint8Array>([['main.py', original]]);
    const tree = new Map<string, VirtualFileEntry>([['main.py', { data: original }]]);

    expect(extractModifiedOrNewFiles(tree, originals)).toEqual([]);
  });
});
