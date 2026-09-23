import { describe, it, expect } from 'vitest';
import type { FileItem } from '../../types/editor';
import {
  buildDirectoryIndex,
  getAncestorFolderIds,
  getVisibleLinearNodes,
} from './treeIndex';

describe('treeIndex', () => {
  const mockFiles: FileItem[] = [
    { id: 'f-src', name: 'src', path: '/src', isFolder: true, parentId: null, language: 'plaintext', updatedAt: 0 },
    { id: 'f-main', name: 'main', path: '/src/main', isFolder: true, parentId: 'f-src', language: 'plaintext', updatedAt: 0 },
    { id: 'f-c', name: 'c', path: '/src/main/c', isFolder: true, parentId: 'f-main', language: 'plaintext', updatedAt: 0 },
    { id: 'f-app-c', name: 'app.c', path: '/src/main/c/app.c', isFolder: false, parentId: 'f-c', language: 'c', updatedAt: 0 },
    { id: 'f-utils-h', name: 'utils.h', path: '/src/main/c/utils.h', isFolder: false, parentId: 'f-c', language: 'h', updatedAt: 0 },
    { id: 'f-readme', name: 'README.md', path: '/README.md', isFolder: false, parentId: null, language: 'markdown', updatedAt: 0 },
  ];

  it('agrupa e indexa filhos com tempo O(1) de acesso', () => {
    const index = buildDirectoryIndex(mockFiles, false);
    const rootChildren = index.childrenByParentId.get(null) || [];

    // Pastas primeiro, depois arquivos
    expect(rootChildren[0].name).toBe('src');
    expect(rootChildren[1].name).toBe('README.md');

    const srcChildren = index.childrenByParentId.get('f-src') || [];
    expect(srcChildren.length).toBe(1);
    expect(srcChildren[0].name).toBe('main');
  });

  it('calcula ancestrais de nós até a raiz para auto-reveal', () => {
    const index = buildDirectoryIndex(mockFiles, false);
    const ancestors = getAncestorFolderIds('f-app-c', index);

    expect(ancestors).toEqual(['f-src', 'f-main', 'f-c']);
  });

  it('compacta diretórios em cadeia de filho único (Compact Folders)', () => {
    const index = buildDirectoryIndex(mockFiles, true);

    // 'src' tem apenas 'main', que tem apenas 'c'
    expect(index.compactChains.has('f-src')).toBe(true);
    const chain = index.compactChains.get('f-src')!;
    expect(chain.label).toBe('src / main / c');
    expect(chain.leafFolder.id).toBe('f-c');

    // 'main' e 'c' são marcados como intermediários
    expect(index.isIntermediateCompactFolder.has('f-main')).toBe(true);
    expect(index.isIntermediateCompactFolder.has('f-c')).toBe(true);
  });

  it('gera lista linear de nós visíveis respeitando pastas expandidas', () => {
    const index = buildDirectoryIndex(mockFiles, true);

    // Inicialmente sem pastas abertas: deve exibir nó compactado 'src / main / c' e 'README.md'
    let visible = getVisibleLinearNodes(index, new Set());
    expect(visible.map((v) => v.item.name)).toEqual(['src', 'README.md']);

    // Ao expandir a pasta 'f-src' (ou folha 'f-c'), seus filhos devem aparecer na lista linear
    visible = getVisibleLinearNodes(index, new Set(['f-src', 'f-c']));
    expect(visible.map((v) => v.item.name)).toEqual(['src', 'app.c', 'utils.h', 'README.md']);
  });

  it('suporta type-to-filter mantendo ancestrais visíveis e abrindo pastas automaticamente', () => {
    const index = buildDirectoryIndex(mockFiles, false);

    // Filtra por 'app' sem ter nenhuma pasta previamente expandida
    const visible = getVisibleLinearNodes(index, new Set(), 'app');
    const names = visible.map((v) => v.item.name);

    expect(names).toContain('src');
    expect(names).toContain('main');
    expect(names).toContain('c');
    expect(names).toContain('app.c');
    expect(names).not.toContain('README.md');
    expect(names).not.toContain('utils.h');
  });
});
