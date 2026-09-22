/**
 * Utilitário compartilhado entre Web Workers: compara um sistema de arquivos
 * virtual (Map caminho → inode/bytes) com o estado original e devolve apenas
 * os arquivos criados ou modificados durante a execução.
 */

export interface VirtualFileEntry {
  data: Uint8Array;
  isFolder?: boolean;
  children?: Map<string, VirtualFileEntry>;
}

export interface SyncedFileEntry {
  path: string;
  data: Uint8Array;
  isNew?: boolean;
}

export function extractModifiedOrNewFiles(
  dirMap: Map<string, VirtualFileEntry>,
  originals: Map<string, Uint8Array>,
  currentPath = ''
): SyncedFileEntry[] {
  const result: SyncedFileEntry[] = [];

  for (const [name, entry] of dirMap.entries()) {
    const relPath = currentPath ? `${currentPath}/${name}` : name;

    if (entry.children) {
      result.push(...extractModifiedOrNewFiles(entry.children, originals, relPath));
      continue;
    }

    const orig = originals.get(relPath);
    let isModified = false;
    let isNew = false;

    if (!orig) {
      isModified = true;
      isNew = true;
    } else if (orig.length !== entry.data.length) {
      isModified = true;
    } else {
      for (let i = 0; i < orig.length; i++) {
        if (orig[i] !== entry.data[i]) {
          isModified = true;
          break;
        }
      }
    }

    if (isModified) {
      result.push({ path: relPath, data: entry.data, isNew });
    }
  }

  return result;
}

export interface MinimalFileSystem {
  readdir(path: string): string[];
  stat(path: string): { mode: number };
  isDir(mode: number): boolean;
  unlink(path: string): void;
  rmdir(path: string): void;
}

/**
 * Remove recursivamente o conteúdo de um diretório em um FS estilo Emscripten.
 *
 * Importante: `FS.rmdir(path, { recursive: true })` NÃO é suportado pelo
 * Emscripten (lança ErrnoError 55 / ENOTEMPTY). Sem esta limpeza manual, o
 * diretório de trabalho acumula arquivos de execuções anteriores, que seriam
 * reportados como "novos" e gravados indevidamente no workspace do usuário.
 */
export function clearDirectory(fs: MinimalFileSystem, path: string): void {
  let entries: string[];
  try {
    entries = fs.readdir(path);
  } catch {
    return; // diretório não existe
  }

  for (const name of entries) {
    if (name === '.' || name === '..') continue;
    const fullPath = `${path}/${name}`;
    const stat = fs.stat(fullPath);
    if (fs.isDir(stat.mode)) {
      clearDirectory(fs, fullPath);
      fs.rmdir(fullPath);
    } else {
      fs.unlink(fullPath);
    }
  }
}
