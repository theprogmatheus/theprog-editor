import type { FileItem, SupportedLanguage } from '../types/editor';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
]);

export function shouldIgnoreEntry(name: string, isDirectory = false): boolean {
  // Ignora apenas diretórios de controle de versão/dependências para não travar a recursão do navegador
  if (isDirectory && IGNORED_DIRECTORIES.has(name)) {
    return true;
  }
  // TODOS os arquivos do diretório podem ser visualizados normalmente no editor
  return false;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function detectLanguage(filename: string): SupportedLanguage {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.c')) return 'c';
  if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) return 'cpp';
  if (lower.endsWith('.h') || lower.endsWith('.hpp')) return 'h';
  return 'plaintext';
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('A File System Access API não é suportada neste navegador.');
  }

  return await (window as any).showDirectoryPicker({
    mode: 'readwrite',
  });
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  readWrite = true
): Promise<boolean> {
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    const queryStatus = await (handle as any).queryPermission(options);
    if (queryStatus === 'granted') {
      return true;
    }
    const requestStatus = await (handle as any).requestPermission(options);
    return requestStatus === 'granted';
  } catch (err) {
    console.warn('Erro ao verificar permissão do diretório:', err);
    return false;
  }
}

export async function getFileHandleByPath(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string
): Promise<FileSystemFileHandle | null> {
  try {
    const cleanPath = relPath.replace(/^\.?\//, '').trim();
    const parts = cleanPath.split('/').filter(Boolean);
    let currentDir = rootHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], { create: false });
    }
    return await currentDir.getFileHandle(parts[parts.length - 1]);
  } catch {
    return null;
  }
}

/**
 * Lê recursivamente todos os arquivos e subpastas a partir do handle do diretório.
 * ATENÇÃO: Nunca gera arquivos em diretórios do disco; respeita exatamente o conteúdo real.
 */
export async function readDirectoryTree(
  dirHandle: FileSystemDirectoryHandle,
  basePath = '',
  parentId: string | null = null,
  maxDepth = 8
): Promise<FileItem[]> {
  if (maxDepth <= 0) return [];

  const items: FileItem[] = [];

  try {
    for await (const entry of (dirHandle as any).values()) {
      const isDir = entry.kind === 'directory';
      if (shouldIgnoreEntry(entry.name, isDir)) {
        continue;
      }

      const itemPath = basePath ? `${basePath}/${entry.name}` : `/${entry.name}`;
      const id = 'local-' + itemPath.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (entry.kind === 'directory') {
        const folderHandle = entry as FileSystemDirectoryHandle;
        const folderItem: FileItem = {
          id,
          name: entry.name,
          path: itemPath,
          isFolder: true,
          parentId,
          language: 'plaintext',
          updatedAt: Date.now(),
          handle: folderHandle,
        };
        items.push(folderItem);

        const subItems = await readDirectoryTree(folderHandle, itemPath, id, maxDepth - 1);
        items.push(...subItems);
      } else if (entry.kind === 'file') {
        const fileHandle = entry as FileSystemFileHandle;
        let content = '';
        let lastModified = Date.now();

        try {
          const file = await fileHandle.getFile();
          lastModified = file.lastModified;

          // Lê conteúdo de arquivos com tamanho de até 5MB
          if (file.size <= 5 * 1024 * 1024) {
            content = await file.text();
          } else {
            content = '/* Arquivo muito grande para exibição inline (> 5MB) */';
          }
        } catch (readErr) {
          console.warn(`Erro ao ler arquivo ${entry.name}:`, readErr);
        }

        items.push({
          id,
          name: entry.name,
          path: itemPath,
          isFolder: false,
          parentId,
          language: detectLanguage(entry.name),
          updatedAt: lastModified,
          content,
          handle: fileHandle,
        });
      }
    }
  } catch (err) {
    console.error('Erro ao ler diretório do disco:', err);
  }

  return items;
}

/**
 * Grava conteúdo em um arquivo no disco (cria diretórios intermediários se necessário).
 */
export async function saveFileToDisk(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string,
  content: string | Uint8Array
): Promise<void> {
  const cleanPath = relPath.replace(/^\.?\//, '').trim();
  if (!cleanPath) return;

  recordInternalWrite(cleanPath);

  const parts = cleanPath.split('/').filter(Boolean);
  let currentDir = rootHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
  }

  const fileName = parts[parts.length - 1];
  const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await (writable as any).write(content);
  await writable.close();

  recordInternalWrite(cleanPath);
}

const internalWriteTimes = new Map<string, number>();

export function recordInternalWrite(path: string) {
  const norm = '/' + path.replace(/^\.?\//, '').trim();
  internalWriteTimes.set(norm, Date.now());
}

export function isRecentInternalWrite(path: string): boolean {
  const norm = '/' + path.replace(/^\.?\//, '').trim();
  const time = internalWriteTimes.get(norm);
  if (!time) return false;
  return Date.now() - time < 3500;
}

/**
 * Cria um arquivo vazio no disco.
 */
export async function createFileOnDisk(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string
): Promise<void> {
  const cleanPath = relPath.replace(/^\.?\//, '').trim();
  recordInternalWrite(cleanPath);
  await saveFileToDisk(rootHandle, relPath, '');
  recordInternalWrite(cleanPath);
}

/**
 * Cria uma pasta no disco.
 */
export async function createFolderOnDisk(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string
): Promise<void> {
  const cleanPath = relPath.replace(/^\.?\//, '').trim();
  if (!cleanPath) return;
  recordInternalWrite(cleanPath);

  const parts = cleanPath.split('/').filter(Boolean);
  let currentDir = rootHandle;

  for (const part of parts) {
    currentDir = await currentDir.getDirectoryHandle(part, { create: true });
  }

  recordInternalWrite(cleanPath);
}

/**
 * Remove um arquivo ou pasta do disco.
 */
export async function deleteFromDisk(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string,
  isFolder: boolean
): Promise<void> {
  const cleanPath = relPath.replace(/^\.?\//, '').trim();
  if (!cleanPath) return;

  const parts = cleanPath.split('/').filter(Boolean);
  let currentDir = rootHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], { create: false });
  }

  const targetName = parts[parts.length - 1];
  await currentDir.removeEntry(targetName, { recursive: isFolder });

  recordInternalWrite(cleanPath);
}

/**
 * Renomeia um arquivo ou pasta no disco.
 */
export async function renameOnDisk(
  rootHandle: FileSystemDirectoryHandle,
  oldRelPath: string,
  newRelPath: string,
  isFolder: boolean = false
): Promise<void> {
  const cleanOld = oldRelPath.replace(/^\.?\//, '').trim();
  const cleanNew = newRelPath.replace(/^\.?\//, '').trim();
  if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

  const oldParts = cleanOld.split('/').filter(Boolean);
  const newParts = cleanNew.split('/').filter(Boolean);

  let oldParentDir = rootHandle;
  for (let i = 0; i < oldParts.length - 1; i++) {
    oldParentDir = await oldParentDir.getDirectoryHandle(oldParts[i], { create: false });
  }

  const oldName = oldParts[oldParts.length - 1];
  const newName = newParts[newParts.length - 1];

  try {
    if (!isFolder) {
      const oldFileHandle = await oldParentDir.getFileHandle(oldName);
      // Chromium 111+ suporta move()
      if ('move' in oldFileHandle && typeof (oldFileHandle as any).move === 'function') {
        await (oldFileHandle as any).move(newName);
        recordInternalWrite(cleanOld);
        recordInternalWrite(cleanNew);
        return;
      }

      // Fallback: copiar conteúdo, criar novo e deletar antigo
      const file = await oldFileHandle.getFile();
      const content = await file.arrayBuffer();
      await saveFileToDisk(rootHandle, cleanNew, new Uint8Array(content));
      await oldParentDir.removeEntry(oldName, { recursive: false });
      recordInternalWrite(cleanOld);
      recordInternalWrite(cleanNew);
    } else {
      const oldDirHandle = await oldParentDir.getDirectoryHandle(oldName);
      if ('move' in oldDirHandle && typeof (oldDirHandle as any).move === 'function') {
        await (oldDirHandle as any).move(newName);
        recordInternalWrite(cleanOld);
        recordInternalWrite(cleanNew);
        return;
      }
      throw new Error('Renomeação de pastas requer suporte nativo a move() no navegador.');
    }
  } catch (err) {
    console.error('Erro ao renomear no disco:', err);
    throw err;
  }
}

export interface FileMetadataSnapshot {
  path: string;
  isFolder: boolean;
  lastModified: number;
  size: number;
}

/**
 * Escaneia apenas os metadados da árvore de arquivos (nomes, tipos, timestamps)
 * de forma ultra-rápida sem carregar o conteúdo dos arquivos na memória.
 */
export async function scanDirectorySnapshot(
  dirHandle: FileSystemDirectoryHandle,
  basePath = '',
  maxDepth = 8
): Promise<Map<string, FileMetadataSnapshot>> {
  if (maxDepth <= 0) return new Map();

  const map = new Map<string, FileMetadataSnapshot>();

  try {
    for await (const entry of (dirHandle as any).values()) {
      const isDir = entry.kind === 'directory';
      if (shouldIgnoreEntry(entry.name, isDir)) {
        continue;
      }

      const itemPath = basePath ? `${basePath}/${entry.name}` : `/${entry.name}`;

      if (entry.kind === 'directory') {
        map.set(itemPath, {
          path: itemPath,
          isFolder: true,
          lastModified: 0,
          size: 0,
        });

        const subMap = await scanDirectorySnapshot(
          entry as FileSystemDirectoryHandle,
          itemPath,
          maxDepth - 1
        );
        subMap.forEach((val, key) => map.set(key, val));
      } else if (entry.kind === 'file') {
        const fileHandle = entry as FileSystemFileHandle;
        try {
          const file = await fileHandle.getFile();
          map.set(itemPath, {
            path: itemPath,
            isFolder: false,
            lastModified: file.lastModified,
            size: file.size,
          });
        } catch {
          // Arquivo pode estar sendo gravado ou bloqueado no SO
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao escanear snapshot de diretório:', err);
  }

  return map;
}

/**
 * Inicializa um observador inteligente de mudanças externas no diretório do OS.
 * Combina:
 * 1. Eventos de foco da janela (`window.focus` e `visibilitychange`).
 * 2. Polling ultraleve de metadados a cada 2.5 segundos enquanto a aba estiver visível.
 * (Evita FileSystemObserver experimental em modo anônimo para prevenir crashes de renderer).
 */
export function startDirectoryAutoSync(
  _dirHandle: FileSystemDirectoryHandle,
  onSyncNeeded: () => void
): () => void {
  let isStopped = false;
  let isChecking = false;

  const trigger = () => {
    if (isStopped || isChecking) return;
    isChecking = true;
    try {
      onSyncNeeded();
    } finally {
      isChecking = false;
    }
  };

  // Sincroniza imediatamente ao focar na janela do navegador
  const onFocus = () => trigger();
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      trigger();
    }
  };

  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Polling leve periódico apenas se a aba estiver visível
  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible') {
      trigger();
    }
  }, 2500);

  return () => {
    isStopped = true;
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    clearInterval(intervalId);
  };
}
