import type { FileItem } from '../types/editor';
import type { FileKind } from './languages/types';
import {
  detectFileKindByExtension,
  detectFileKindFromBytes,
  detectLanguage,
} from './languages/registry';

const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  '.theprog',
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

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('A File System Access API não é suportada neste navegador.');
  }

  return await window.showDirectoryPicker({
    mode: 'readwrite',
  });
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  readWrite = true
): Promise<boolean> {
  const options: FileSystemPermissionDescriptor = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    const queryStatus = await handle.queryPermission(options);
    if (queryStatus === 'granted') {
      return true;
    }
    const requestStatus = await handle.requestPermission(options);
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
 * Lê os bytes de um arquivo do disco a partir do caminho relativo.
 */
export async function readFileFromDisk(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string
): Promise<Uint8Array | null> {
  try {
    const handle = await getFileHandleByPath(rootHandle, relPath);
    if (!handle) return null;
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
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
    for await (const entry of dirHandle.values()) {
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
        let content: string | undefined = '';
        let lastModified = Date.now();
        let kind: FileKind = 'text';
        let size = 0;

        try {
          const file = await fileHandle.getFile();
          lastModified = file.lastModified;
          size = file.size;

          const extensionKind = detectFileKindByExtension(entry.name);
          kind = extensionKind || 'text';

          if (file.size <= 5 * 1024 * 1024) {
            if (extensionKind === null) {
              const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
              kind = detectFileKindFromBytes(head);
            }
            if (kind === 'text') {
              content = await file.text();
            } else {
              content = undefined;
            }
          } else {
            kind = extensionKind === 'image' ? 'image' : extensionKind === 'binary' ? 'binary' : 'too_large';
            content = undefined;
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
          kind,
          size,
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

  const parts = cleanPath.split('/').filter(Boolean);
  let currentDir = rootHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
  }

  const fileName = parts[parts.length - 1];
  const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
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

  let newParentDir = rootHandle;
  for (let i = 0; i < newParts.length - 1; i++) {
    newParentDir = await newParentDir.getDirectoryHandle(newParts[i], { create: true });
  }

  const oldName = oldParts[oldParts.length - 1];
  const newName = newParts[newParts.length - 1];
  const isCrossDir = oldParts.slice(0, -1).join('/') !== newParts.slice(0, -1).join('/');

  try {
    if (!isFolder) {
      const oldFileHandle = await oldParentDir.getFileHandle(oldName);
      // Chromium 111+ suporta move()
      if (typeof oldFileHandle.move === 'function') {
        if (isCrossDir) {
          await oldFileHandle.move(newParentDir, newName);
        } else {
          await oldFileHandle.move(newName);
        }
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
      if (typeof oldDirHandle.move === 'function') {
        if (isCrossDir) {
          await oldDirHandle.move(newParentDir, newName);
        } else {
          await oldDirHandle.move(newName);
        }
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
 * Retorna null se a leitura do diretório raiz falhar, evitando que o sync apague
 * os arquivos em memória por engano.
 */
export async function scanDirectorySnapshot(
  dirHandle: FileSystemDirectoryHandle,
  basePath = '',
  maxDepth = 8
): Promise<Map<string, FileMetadataSnapshot> | null> {
  if (maxDepth <= 0) return new Map();

  const map = new Map<string, FileMetadataSnapshot>();

  try {
    for await (const entry of dirHandle.values()) {
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
        if (subMap) {
          subMap.forEach((val, key) => map.set(key, val));
        }
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
    if (!basePath) {
      return null;
    }
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
