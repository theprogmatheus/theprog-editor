import type { FileItem } from '../../types/editor';

export interface CompactFolderChain {
  rootFolder: FileItem;
  leafFolder: FileItem;
  folders: FileItem[];
  label: string;
}

export interface DirectoryIndex {
  childrenByParentId: Map<string | null, FileItem[]>;
  fileById: Map<string, FileItem>;
  ancestorsById: Map<string, string[]>;
  compactChains: Map<string, CompactFolderChain>;
  isIntermediateCompactFolder: Set<string>;
}

export interface VisibleNode {
  id: string;
  item: FileItem;
  depth: number;
  isFolder: boolean;
  compactChain?: CompactFolderChain;
}

/**
 * Ordena nós: pastas primeiro, depois arquivos, ordenados alfanumericamente.
 */
export function sortFileItems(items: FileItem[]): FileItem[] {
  return [...items].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Constrói o índice de diretório memoizado em tempo O(N).
 */
export function buildDirectoryIndex(
  files: FileItem[],
  compactEnabled = true
): DirectoryIndex {
  const childrenByParentId = new Map<string | null, FileItem[]>();
  const fileById = new Map<string, FileItem>();
  const ancestorsById = new Map<string, string[]>();
  const compactChains = new Map<string, CompactFolderChain>();
  const isIntermediateCompactFolder = new Set<string>();

  // Popula mapa de arquivos e inicializa listas de filhos
  childrenByParentId.set(null, []);
  for (const f of files) {
    fileById.set(f.id, f);
    if (!childrenByParentId.has(f.id)) {
      childrenByParentId.set(f.id, []);
    }
  }

  // Agrupa filhos por parentId
  for (const f of files) {
    const pid = f.parentId ?? null;
    const list = childrenByParentId.get(pid);
    if (list) {
      list.push(f);
    } else {
      childrenByParentId.set(pid, [f]);
    }
  }

  // Ordena os filhos de cada diretório
  for (const [key, list] of childrenByParentId.entries()) {
    childrenByParentId.set(key, sortFileItems(list));
  }

  // Calcula ancestrais de cada item (caminho até a raiz)
  for (const f of files) {
    const ancestors: string[] = [];
    let currentPid = f.parentId;
    while (currentPid) {
      ancestors.unshift(currentPid);
      const parent = fileById.get(currentPid);
      currentPid = parent ? parent.parentId : null;
    }
    ancestorsById.set(f.id, ancestors);
  }

  // Calcula compactação de pastas de filho único se habilitado
  if (compactEnabled) {
    for (const f of files) {
      if (!f.isFolder) continue;
      // Se esta pasta já é intermediária de uma cadeia anterior, não inicia nova cadeia aqui
      if (isIntermediateCompactFolder.has(f.id)) continue;

      const children = childrenByParentId.get(f.id) || [];
      // Se tiver exatamente 1 filho e ele for pasta, inicia compactação
      if (children.length === 1 && children[0].isFolder) {
        const chainFolders: FileItem[] = [f];
        let curr = children[0];

        while (curr && curr.isFolder) {
          chainFolders.push(curr);
          isIntermediateCompactFolder.add(curr.id);
          const nextChildren = childrenByParentId.get(curr.id) || [];
          if (nextChildren.length === 1 && nextChildren[0].isFolder) {
            curr = nextChildren[0];
          } else {
            break;
          }
        }

        const leafFolder = chainFolders[chainFolders.length - 1];
        const label = chainFolders.map((item) => item.name).join(' / ');
        compactChains.set(f.id, {
          rootFolder: f,
          leafFolder,
          folders: chainFolders,
          label,
        });
      }
    }
  }

  return {
    childrenByParentId,
    fileById,
    ancestorsById,
    compactChains,
    isIntermediateCompactFolder,
  };
}

/**
 * Retorna os IDs das pastas ancestrais de um arquivo para auto-reveal.
 */
export function getAncestorFolderIds(fileId: string, indexOrFiles: DirectoryIndex | FileItem[]): string[] {
  if (Array.isArray(indexOrFiles)) {
    const fileMap = new Map<string, FileItem>();
    for (const f of indexOrFiles) fileMap.set(f.id, f);
    const ancestors: string[] = [];
    let curr = fileMap.get(fileId);
    while (curr?.parentId) {
      ancestors.unshift(curr.parentId);
      curr = fileMap.get(curr.parentId);
    }
    return ancestors;
  }
  return indexOrFiles.ancestorsById.get(fileId) || [];
}

/**
 * Retorna a lista linear dos nós visíveis atualmente no DOM para navegação por teclado.
 */
export function getVisibleLinearNodes(
  index: DirectoryIndex,
  expandedFolders: Set<string>,
  filterQuery = ''
): VisibleNode[] {
  const result: VisibleNode[] = [];
  const cleanFilter = filterQuery.trim().toLowerCase();

  // Se houver filtro ativo, identifica quais itens combinam e quais pastas precisam ser mostradas
  const matchingItemIds = new Set<string>();
  const foldersToForceOpen = new Set<string>();

  if (cleanFilter) {
    for (const [id, file] of index.fileById.entries()) {
      if (file.name.toLowerCase().includes(cleanFilter)) {
        matchingItemIds.add(id);
        const ancestors = index.ancestorsById.get(id) || [];
        for (const ancId of ancestors) {
          foldersToForceOpen.add(ancId);
        }
      }
    }
  }

  function traverse(parentId: string | null, depth: number) {
    const children = index.childrenByParentId.get(parentId) || [];

    for (const item of children) {
      // Ignora pastas intermediárias que já estão integradas no rótulo da pasta pai compactada
      if (index.isIntermediateCompactFolder.has(item.id)) {
        continue;
      }

      // Se houver filtro, só exibe se o item der match ou se for uma pasta que contém matches
      if (cleanFilter) {
        const isMatch = matchingItemIds.has(item.id);
        const hasMatchingDescendant = item.isFolder && foldersToForceOpen.has(item.id);
        if (!isMatch && !hasMatchingDescendant) {
          continue;
        }
      }

      const chain = index.compactChains.get(item.id);
      const isFolder = item.isFolder;

      result.push({
        id: item.id,
        item,
        depth,
        isFolder,
        compactChain: chain,
      });

      if (isFolder) {
        // Uma pasta está aberta se estiver no expandedFolders ou se o filtro forçar
        const effectiveLeafId = chain ? chain.leafFolder.id : item.id;
        const isOpen =
          (cleanFilter && (foldersToForceOpen.has(item.id) || foldersToForceOpen.has(effectiveLeafId))) ||
          expandedFolders.has(item.id) ||
          (chain && expandedFolders.has(effectiveLeafId));

        if (isOpen) {
          traverse(effectiveLeafId, depth + 1);
        }
      }
    }
  }

  traverse(null, 0);
  return result;
}
