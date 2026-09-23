import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  FilePlus,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileWarning,
  FileImage,
  Trash2,
  Edit2,
  Folder,
  FolderOpen,
  Check,
  X,
  ChevronLeft,
  RefreshCw,
  ChevronsDownUp,
  Search,
  Copy,
  Download,
  Files,
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useDialog } from '../../context/DialogContext';
import type { FileItem } from '../../types/editor';
import {
  buildDirectoryIndex,
  getVisibleLinearNodes,
  getAncestorFolderIds,
  type CompactFolderChain,
  type VisibleNode,
} from '../../services/fileTree/treeIndex';
import { isPathValidForCreation } from '../../services/fileTree/pathUtils';
import { saveFileToDisk } from '../../services/localFs';
import { saveFileToStorage } from '../../services/storage';

interface CreatingState {
  parentId: string | null;
  isFolder: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  file?: FileItem | null;
  chain?: CompactFolderChain;
}

export const Sidebar: React.FC = () => {
  const { showConfirm } = useDialog();
  const {
    files,
    activeFileId,
    openFile,
    pinTab,
    createNewFile,
    deleteFile,
    renameFile,
    moveFileItem,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    sidebarWidth,
    setSidebarWidth,
    activeWorkspace,
    openWorkspacePicker,
    refreshCurrentWorkspace,
    compactFolders,
    enableGitExperimental,
    gitStatusMap,
  } = useEditor();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleOpenFile = (fileId: string) => {
    openFile(fileId);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  // Estados de Drag and Drop
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState<boolean>(false);
  const dragExpandTimeoutRef = useRef<any>(null);

  // Estados de criação e edição inline
  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Estados de seção e filtro
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());

  // Filtro inline (Type-to-filter)
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const filterInputRef = useRef<HTMLInputElement>(null);

  // Navegação por teclado
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const sidebarRef = useRef<HTMLElement>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de contexto ao clicar fora, apertar Escape ou ao abrir outro menu
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('theprog-close-context-menu', handleClose);
    if (contextMenu) {
      window.addEventListener('click', handleClose);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('theprog-close-context-menu', handleClose);
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Manipulador de redimensionamento da sidebar via drag na borda direita
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX - 48;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setSidebarWidth]);

  // Índice estrutural O(1) de diretórios memoizado
  const directoryIndex = useMemo(() => {
    return buildDirectoryIndex(files, compactFolders ?? true);
  }, [files, compactFolders]);

  // Lista linear de nós visíveis no DOM
  const visibleNodes = useMemo(() => {
    return getVisibleLinearNodes(directoryIndex, expandedFolders, filterQuery);
  }, [directoryIndex, expandedFolders, filterQuery]);

  // Auto-reveal: ao mudar o arquivo ativo no editor, expande pastas ancestrais e faz scroll suave
  useEffect(() => {
    if (!activeFileId) return;
    const ancestors = getAncestorFolderIds(activeFileId, directoryIndex);
    if (ancestors.length > 0) {
      setExpandedFolders((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const pid of ancestors) {
          if (!next.has(pid)) {
            next.add(pid);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    const timer = setTimeout(() => {
      const el = treeContainerRef.current?.querySelector(`[data-tree-item-id="${activeFileId}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 60);

    return () => clearTimeout(timer);
  }, [activeFileId, directoryIndex]);

  // Foco no input de busca ao abrir filtro
  useEffect(() => {
    if (isFilterOpen) {
      filterInputRef.current?.focus();
    }
  }, [isFilterOpen]);

  if (!isSidebarOpen) return null;

  const toggleFolderNode = (node: VisibleNode) => {
    const isExpanded =
      expandedFolders.has(node.id) ||
      (node.compactChain && expandedFolders.has(node.compactChain.leafFolder.id));

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (node.compactChain) {
        // Alterna toda a cadeia compactada
        for (const f of node.compactChain.folders) {
          if (isExpanded) next.delete(f.id);
          else next.add(f.id);
        }
      } else {
        if (isExpanded) next.delete(node.id);
        else next.add(node.id);
      }
      return next;
    });
  };

  const handleStartCreate = (isFolder: boolean, parentId: string | null = null) => {
    setCreatingState({ parentId, isFolder });
    setNewItemName('');
    if (parentId) {
      setExpandedFolders((prev) => new Set(prev).add(parentId));
    }
  };

  const handleConfirmCreate = async () => {
    const trimmed = newItemName.trim();
    if (creatingState && trimmed) {
      if (!isPathValidForCreation(trimmed)) {
        alert(
          'Nome de arquivo ou pasta inválido. Evite caracteres especiais (/ \\ : * ? " < > |) e caminhos relativos.'
        );
        return;
      }
      try {
        await createNewFile(trimmed, creatingState.isFolder, creatingState.parentId);
      } catch (err: any) {
        alert(err?.message || 'Falha ao criar item');
        return;
      }
    }
    setCreatingState(null);
    setNewItemName('');
  };

  const handleCancelCreate = () => {
    setCreatingState(null);
    setNewItemName('');
  };

  const handleStartRename = (file: FileItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(file.id);
    setEditingName(file.name);
  };

  const handleConfirmRename = async (fileId: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      if (!isPathValidForCreation(trimmed)) {
        alert(
          'Nome de arquivo ou pasta inválido. Evite caracteres especiais (/ \\ : * ? " < > |) e caminhos relativos.'
        );
        return;
      }
      try {
        await renameFile(fileId, trimmed);
      } catch (err: any) {
        alert(err?.message || 'Falha ao renomear item');
        return;
      }
    }
    setEditingId(null);
  };

  const handleDelete = async (file: FileItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const title = file.isFolder ? 'Excluir Pasta' : 'Excluir Arquivo';
    const message = file.isFolder
      ? `Tem certeza que deseja excluir a pasta "${file.name}" e todo o seu conteúdo recursivamente?`
      : `Tem certeza que deseja excluir "${file.name}"? Esta ação não pode ser desfeita.`;

    const confirmed = await showConfirm({
      title,
      message,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      danger: true,
    });

    if (confirmed) {
      await deleteFile(file.id);
    }
  };

  const handleDuplicateFile = async (file: FileItem) => {
    if (file.isFolder) return;
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    const base = ext ? file.name.slice(0, -ext.length) : file.name;
    const duplicateName = `${base} copy${ext}`;
    try {
      await createNewFile(duplicateName, false, file.parentId, file.content || '');
    } catch (err: any) {
      alert(err?.message || 'Falha ao duplicar arquivo');
    }
  };

  const handleDownloadSingleFile = (file: FileItem) => {
    if (file.isFolder) return;
    const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Drag-and-drop auto-expand no hover
  const handleDragOverFolder = (folderId: string) => {
    if (!expandedFolders.has(folderId)) {
      if (!dragExpandTimeoutRef.current) {
        dragExpandTimeoutRef.current = setTimeout(() => {
          setExpandedFolders((prev) => new Set(prev).add(folderId));
          dragExpandTimeoutRef.current = null;
        }, 500);
      }
    }
  };

  const handleDragLeaveFolder = () => {
    if (dragExpandTimeoutRef.current) {
      clearTimeout(dragExpandTimeoutRef.current);
      dragExpandTimeoutRef.current = null;
    }
  };

  // Drop universal: aceita movimentação interna e arquivos do sistema operacional
  const handleDropUniversal = async (e: React.DragEvent, targetParentId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    handleDragLeaveFolder();

    // 1. Drag interno entre arquivos/pastas
    if (draggedFileId) {
      if (draggedFileId !== targetParentId) {
        await moveFileItem(draggedFileId, targetParentId);
        if (targetParentId) {
          setExpandedFolders((prev) => new Set(prev).add(targetParentId));
        }
      }
      setDraggedFileId(null);
      setDragOverFolderId(null);
      setIsDragOverRoot(false);
      return;
    }

    // 2. Drag externo de arquivos do sistema operacional (Explorer / Finder)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      for (const file of droppedFiles) {
        try {
          const isBinary =
            file.type.startsWith('image/') ||
            /\.(png|jpe?g|gif|webp|ico|wasm|sqlite|bin|exe|pdf|zip)$/i.test(file.name);

          if (isBinary) {
            const buf = await file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            await createNewFile(file.name, false, targetParentId, '');
            const parent = targetParentId ? files.find((f) => f.id === targetParentId) : null;
            const targetPath = parent ? `${parent.path}/${file.name}` : `/${file.name}`;

            if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
              await saveFileToDisk(activeWorkspace.handle, targetPath, bytes);
            } else {
              const created = files.find((f) => f.path === targetPath);
              if (created) {
                await saveFileToStorage({ ...created, kind: 'binary' });
              }
            }
          } else {
            const text = await file.text();
            await createNewFile(file.name, false, targetParentId, text);
          }
        } catch (err) {
          console.error('Erro ao importar arquivo externo:', err);
        }
      }

      if (targetParentId) {
        setExpandedFolders((prev) => new Set(prev).add(targetParentId));
      }
      setDragOverFolderId(null);
      setIsDragOverRoot(false);
    }
  };

  // Navegação por teclado WAI-ARIA
  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    if (editingId || creatingState) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev === null ? 0 : Math.min(visibleNodes.length - 1, prev + 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (focusedIndex !== null && visibleNodes[focusedIndex]) {
        const node = visibleNodes[focusedIndex];
        if (node.isFolder) {
          const isExpanded =
            expandedFolders.has(node.id) ||
            (node.compactChain && expandedFolders.has(node.compactChain.leafFolder.id));
          if (!isExpanded) {
            toggleFolderNode(node);
          } else if (focusedIndex + 1 < visibleNodes.length) {
            setFocusedIndex(focusedIndex + 1);
          }
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (focusedIndex !== null && visibleNodes[focusedIndex]) {
        const node = visibleNodes[focusedIndex];
        const isExpanded =
          node.isFolder &&
          (expandedFolders.has(node.id) ||
            (node.compactChain && expandedFolders.has(node.compactChain.leafFolder.id)));
        if (isExpanded) {
          toggleFolderNode(node);
        } else if (node.item.parentId) {
          const parentIdx = visibleNodes.findIndex((n) => n.id === node.item.parentId);
          if (parentIdx !== -1) setFocusedIndex(parentIdx);
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex !== null && visibleNodes[focusedIndex]) {
        const node = visibleNodes[focusedIndex];
        if (node.isFolder) {
          toggleFolderNode(node);
        } else {
          handleOpenFile(node.id);
        }
      }
    } else if (e.key === 'F2') {
      e.preventDefault();
      if (focusedIndex !== null && visibleNodes[focusedIndex]) {
        const node = visibleNodes[focusedIndex];
        const target = node.compactChain ? node.compactChain.leafFolder : node.item;
        setEditingId(target.id);
        setEditingName(target.name);
      }
    } else if (e.key === 'Delete') {
      e.preventDefault();
      if (focusedIndex !== null && visibleNodes[focusedIndex]) {
        const node = visibleNodes[focusedIndex];
        const target = node.compactChain ? node.compactChain.rootFolder : node.item;
        handleDelete(target);
      }
    }
  };

  const getFileIcon = (file: FileItem) => {
    if (file.isFolder) {
      return <Folder className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    if (file.kind === 'binary') {
      return <FileWarning className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />;
    }
    if (file.kind === 'image') {
      return <FileImage className="w-4 h-4 text-pink-500 dark:text-pink-400 shrink-0" />;
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.c')) {
      return (
        <span className="w-4 h-4 rounded bg-[#007acc]/20 text-[#007acc] dark:text-[#3794ff] text-[10px] font-bold flex items-center justify-center shrink-0 border border-[#007acc]/40">
          C
        </span>
      );
    }
    if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) {
      return (
        <span className="w-4 h-4 rounded bg-[#00599c]/20 text-[#00599c] dark:text-[#519aba] text-[9px] font-bold flex items-center justify-center shrink-0 border border-[#00599c]/40">
          C++
        </span>
      );
    }
    if (lower.endsWith('.h') || lower.endsWith('.hpp')) {
      return (
        <span className="w-4 h-4 rounded bg-purple-900/30 text-purple-600 dark:text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0 border border-purple-500/40">
          H
        </span>
      );
    }
    if (lower.endsWith('.py')) {
      return (
        <span className="w-4 h-4 rounded bg-sky-500/20 text-sky-600 dark:text-sky-300 text-[9px] font-bold flex items-center justify-center shrink-0 border border-sky-500/40">
          PY
        </span>
      );
    }
    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
      return (
        <span className="w-4 h-4 rounded bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 text-[9px] font-bold flex items-center justify-center shrink-0 border border-yellow-500/40">
          JS
        </span>
      );
    }
    if (lower.endsWith('.ts')) {
      return (
        <span className="w-4 h-4 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[9px] font-bold flex items-center justify-center shrink-0 border border-blue-500/40">
          TS
        </span>
      );
    }
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return (
        <span className="w-4 h-4 rounded bg-neutral-500/20 text-neutral-600 dark:text-neutral-300 text-[8px] font-bold flex items-center justify-center shrink-0 border border-neutral-500/40">
          MD
        </span>
      );
    }
    return <FileCode className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />;
  };

  const renderHighlightedName = (name: string, query: string) => {
    if (!query) return name;
    const lowerName = name.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerName.indexOf(lowerQuery);
    if (index === -1) return name;

    return (
      <>
        {name.slice(0, index)}
        <span className="bg-amber-300 dark:bg-amber-800 text-black dark:text-white font-bold rounded-xs px-0.5">
          {name.slice(index, index + query.length)}
        </span>
        {name.slice(index + query.length)}
      </>
    );
  };

  const renderCreationInput = (depth: number) => {
    return (
      <div
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        className="flex items-center pr-2 py-1 space-x-1.5 bg-[#e8e8e8] dark:bg-[#2a2d2e]"
      >
        {creatingState?.isFolder ? (
          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
        ) : (
          <FileCode className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
        )}
        <input
          type="text"
          value={newItemName}
          placeholder={creatingState?.isFolder ? 'nome da pasta...' : 'ex: src/utils.c, main.c'}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirmCreate();
            if (e.key === 'Escape') handleCancelCreate();
          }}
          autoFocus
          className="flex-1 bg-white dark:bg-[#3c3c3c] text-black dark:text-white px-1.5 py-0.5 rounded text-xs outline-none border border-[#007acc] min-w-0"
        />
        <button
          onClick={handleConfirmCreate}
          className="p-0.5 text-emerald-600 dark:text-emerald-400 hover:opacity-80 cursor-pointer shrink-0"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={handleCancelCreate}
          className="p-0.5 text-rose-600 dark:text-rose-400 hover:opacity-80 cursor-pointer shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop escuro para dispositivos móveis */}
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        ref={sidebarRef}
        style={{ width: isMobile ? '280px' : `${sidebarWidth}px` }}
        data-context-menu="sidebar"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('theprog-close-context-menu'));
          setContextMenu({ x: e.clientX, y: e.clientY, file: null });
        }}
        className="fixed inset-y-0 left-12 z-40 md:relative md:inset-auto md:z-auto flex flex-col bg-[#f3f3f3] dark:bg-[#181818] border-r border-[#e5e5e5] dark:border-[#252526] select-none text-[#333333] dark:text-[#cccccc] text-xs h-full shrink-0 shadow-2xl md:shadow-none transition-[background-color,border-color] duration-150 max-w-[calc(100vw-3rem)]"
      >
        {/* Topo do Explorador com botões globais */}
        <div className="h-9 px-3 flex items-center justify-between font-semibold tracking-wider text-[11px] text-[#616161] dark:text-[#888888] border-b border-[#e5e5e5] dark:border-[#202020]">
          <span className="truncate mr-1">EXPLORADOR</span>
          <div className="flex items-center space-x-0.5 shrink-0">
            <button
              onClick={() => handleStartCreate(false, null)}
              title="Novo Arquivo na raiz"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleStartCreate(true, null)}
              title="Nova Pasta na raiz"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsFilterOpen((prev) => !prev)}
              title="Filtrar Arquivos (Ctrl+F)"
              className={`p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] cursor-pointer transition-colors ${
                isFilterOpen || filterQuery
                  ? 'text-[#007acc] dark:text-[#3794ff] bg-[#007acc]/10'
                  : 'text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await refreshCurrentWorkspace();
                } finally {
                  setTimeout(() => setIsRefreshing(false), 500);
                }
              }}
              title="Recarregar Workspace / Disco"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#007acc]' : ''}`} />
            </button>
            <button
              onClick={() => setExpandedFolders(new Set())}
              title="Colapsar Todas as Pastas"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer"
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleSidebar}
              title="Esconder Barra Lateral"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer ml-0.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Barra de Filtro Rápido Inline */}
        {isFilterOpen && (
          <div className="px-2 py-1.5 border-b border-[#e5e5e5] dark:border-[#202020] bg-[#eaeaea] dark:bg-[#1f1f1f] flex items-center space-x-1 shrink-0 animate-in fade-in duration-100">
            <Search className="w-3 h-3 text-[#888888] shrink-0" />
            <input
              ref={filterInputRef}
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrar arquivos..."
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setFilterQuery('');
                  setIsFilterOpen(false);
                }
              }}
              className="flex-1 bg-white dark:bg-[#2b2b2b] text-black dark:text-white px-1.5 py-0.5 rounded text-xs outline-none border border-[#007acc] min-w-0"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="p-0.5 text-[#888888] hover:text-black dark:hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Seção Workspace Hierárquica */}
        <div
          ref={treeContainerRef}
          role="tree"
          tabIndex={0}
          onKeyDown={handleTreeKeyDown}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setIsDragOverRoot(true);
          }}
          onDragLeave={() => {
            setIsDragOverRoot(false);
          }}
          onDrop={(e) => handleDropUniversal(e, null)}
          className={`flex-1 overflow-y-auto transition-colors outline-none focus:ring-1 focus:ring-[#007acc]/40 ${
            isDragOverRoot && !dragOverFolderId ? 'bg-[#007acc]/10 ring-1 ring-[#007acc]' : ''
          }`}
        >
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-[#333333] dark:text-[#aaaaaa] hover:bg-[#e8e8e8] dark:hover:bg-[#2a2d2e] group">
            <div
              onClick={() => setIsSectionOpen(!isSectionOpen)}
              className="flex items-center space-x-1.5 cursor-pointer truncate flex-1 min-w-0"
            >
              {isSectionOpen ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="uppercase tracking-wider truncate" title={`Espaço de Trabalho: ${activeWorkspace.name}`}>
                {activeWorkspace.name}
              </span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded font-mono shrink-0 ${
                  activeWorkspace.type === 'local'
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                }`}
              >
                {activeWorkspace.type === 'local' ? 'LOCAL' : 'SANDBOX'}
              </span>
            </div>
          </div>

          {isSectionOpen && (
            <div className="py-1 min-h-[50px]">
              {creatingState?.parentId === null && renderCreationInput(0)}

              {visibleNodes.map((node, index) => {
                const item = node.item;
                const isFolder = node.isFolder;
                const isExpanded =
                  expandedFolders.has(node.id) ||
                  (node.compactChain && expandedFolders.has(node.compactChain.leafFolder.id));
                const isActive = !isFolder && item.id === activeFileId;
                const isEditing = item.id === editingId;
                const isFocused = index === focusedIndex;

                const isHiddenOrIgnored =
                  item.name.startsWith('.') ||
                  (node.compactChain && node.compactChain.folders.some((f) => f.name.startsWith('.')));

                if (isFolder) {
                  const targetCreateFolderId = node.compactChain
                    ? node.compactChain.leafFolder.id
                    : item.id;
                  const targetRenameFolder = node.compactChain ? node.compactChain.leafFolder : item;
                  const targetDeleteFolder = node.compactChain ? node.compactChain.rootFolder : item;

                  return (
                    <div key={node.id}>
                      <div
                        role="treeitem"
                        aria-expanded={isExpanded}
                        aria-selected={isFocused}
                        data-tree-item-id={node.id}
                        draggable={true}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', item.id);
                          setDraggedFileId(item.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = 'move';
                          if (draggedFileId !== item.id) {
                            setDragOverFolderId(item.id);
                            handleDragOverFolder(targetCreateFolderId);
                          }
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          if (dragOverFolderId === item.id) {
                            setDragOverFolderId(null);
                            handleDragLeaveFolder();
                          }
                        }}
                        onDrop={(e) => handleDropUniversal(e, targetCreateFolderId)}
                        onDragEnd={() => {
                          setDraggedFileId(null);
                          setDragOverFolderId(null);
                          handleDragLeaveFolder();
                        }}
                        onClick={() => {
                          setFocusedIndex(index);
                          toggleFolderNode(node);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent('theprog-close-context-menu'));
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            file: item,
                            chain: node.compactChain,
                          });
                        }}
                        style={{ paddingLeft: `${8 + node.depth * 14}px` }}
                        className={`group flex items-center justify-between pr-2 py-1 cursor-pointer transition-colors ${
                          draggedFileId === item.id ? 'opacity-40' : ''
                        } ${
                          dragOverFolderId === item.id
                            ? 'bg-[#007acc]/20 dark:bg-[#007acc]/30 ring-1 ring-[#007acc]'
                            : isFocused
                            ? 'bg-[#e4e6f1] dark:bg-[#37373d] text-black dark:text-white'
                            : 'hover:bg-[#e8e8e8] dark:hover:bg-[#2a2d2e]'
                        } ${isHiddenOrIgnored ? 'opacity-60 hover:opacity-100 transition-opacity' : ''} text-[#333333] dark:text-[#cccccc]`}
                      >
                        <div className="flex items-center space-x-1 truncate flex-1 mr-1">
                          <span className="p-0.5 text-[#616161] dark:text-[#888888] shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </span>
                          {isExpanded ? (
                            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                          ) : (
                            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                          )}

                          {isEditing ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmRename(item.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              className="bg-white dark:bg-[#3c3c3c] text-black dark:text-white px-1.5 py-0.5 rounded text-xs outline-none border border-[#007acc] w-full"
                            />
                          ) : node.compactChain ? (
                            <span className="truncate font-medium flex items-center space-x-1">
                              {node.compactChain.folders.map((f, fIdx) => (
                                <React.Fragment key={f.id}>
                                  {fIdx > 0 && <span className="text-[#888888] font-normal mx-0.5">/</span>}
                                  <span>{renderHighlightedName(f.name, filterQuery)}</span>
                                </React.Fragment>
                              ))}
                            </span>
                          ) : (
                            <span className="truncate font-medium">
                              {renderHighlightedName(item.name, filterQuery)}
                            </span>
                          )}
                        </div>

                        {/* Ações de Hover da Pasta */}
                        {!isEditing && (
                          <div className="hidden group-hover:flex items-center space-x-0.5 shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartCreate(false, targetCreateFolderId);
                              }}
                              title="Novo Arquivo nesta pasta"
                              className="p-1 hover:text-[#007acc] cursor-pointer"
                            >
                              <FilePlus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartCreate(true, targetCreateFolderId);
                              }}
                              title="Nova Subpasta nesta pasta"
                              className="p-1 hover:text-[#007acc] cursor-pointer"
                            >
                              <FolderPlus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleStartRename(targetRenameFolder, e)}
                              title="Renomear Pasta"
                              className="p-1 hover:text-[#007acc] cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(targetDeleteFolder, e)}
                              title="Excluir Pasta"
                              className="p-1 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Input de criação aninhado logo após a pasta aberta */}
                      {creatingState?.parentId === targetCreateFolderId &&
                        renderCreationInput(node.depth + 1)}
                    </div>
                  );
                }

                const gitBadge = enableGitExperimental
                  ? gitStatusMap?.get(item.path) || gitStatusMap?.get(item.path.replace(/^\//, ''))
                  : undefined;

                return (
                  <div
                    key={node.id}
                    role="treeitem"
                    aria-selected={isActive}
                    data-tree-item-id={node.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', item.id);
                      setDraggedFileId(item.id);
                    }}
                    onDragEnd={() => {
                      setDraggedFileId(null);
                      setDragOverFolderId(null);
                    }}
                    onClick={() => {
                      setFocusedIndex(index);
                      handleOpenFile(item.id);
                    }}
                    onDoubleClick={() => pinTab(item.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent('theprog-close-context-menu'));
                      setContextMenu({ x: e.clientX, y: e.clientY, file: item });
                    }}
                    style={{ paddingLeft: `${18 + node.depth * 14}px` }}
                    className={`group flex items-center justify-between pr-2 py-1 cursor-pointer transition-colors ${
                      draggedFileId === item.id ? 'opacity-40' : ''
                    } ${
                      isActive
                        ? 'bg-[#e4e6f1] dark:bg-[#37373d] text-black dark:text-white font-medium border-l-2 border-[#007acc]'
                        : isFocused
                        ? 'bg-[#ececec] dark:bg-[#2b2b2b]'
                        : 'hover:bg-[#e8e8e8] dark:hover:bg-[#2a2d2e] text-[#333333] dark:text-[#cccccc]'
                    } ${isHiddenOrIgnored ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}
                  >
                    <div className="flex items-center space-x-2 truncate flex-1 mr-1">
                      {getFileIcon(item)}

                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename(item.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white dark:bg-[#3c3c3c] text-black dark:text-white px-1.5 py-0.5 rounded text-xs outline-none border border-[#007acc] w-full"
                        />
                      ) : (
                        <span className="truncate">{renderHighlightedName(item.name, filterQuery)}</span>
                      )}
                    </div>

                    {/* Git Status Badge */}
                    {!isEditing && gitBadge && (
                      <span
                        className={`font-mono text-[10px] font-bold px-1 rounded shrink-0 mr-1 ${
                          gitBadge === 'M'
                            ? 'text-amber-500'
                            : gitBadge === 'U' || gitBadge === 'A'
                            ? 'text-emerald-500'
                            : 'text-rose-500'
                        }`}
                        title={`Git: ${
                          gitBadge === 'M'
                            ? 'Modificado'
                            : gitBadge === 'U'
                            ? 'Não rastreado'
                            : gitBadge === 'A'
                            ? 'Adicionado'
                            : 'Excluído'
                        }`}
                      >
                        {gitBadge}
                      </span>
                    )}

                    {/* Ações de Hover (Renomear / Excluir) */}
                    {!isEditing && (
                      <div className="hidden group-hover:flex items-center space-x-1 shrink-0">
                        <button
                          onClick={(e) => handleStartRename(item, e)}
                          title="Renomear"
                          className="p-1 hover:text-[#007acc] cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(item, e)}
                          title="Excluir"
                          className="p-1 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleNodes.length === 0 && !creatingState && (
                <div className="p-4 text-center text-xs text-[#888888] space-y-2">
                  <p>{filterQuery ? 'Nenhum arquivo corresponde ao filtro.' : 'Esta pasta está vazia.'}</p>
                  {!filterQuery && (
                    <button
                      onClick={() => handleStartCreate(false, null)}
                      className="px-2.5 py-1 rounded bg-[#007acc] text-white text-[11px] font-medium hover:bg-[#0062a3] cursor-pointer"
                    >
                      Criar Arquivo
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Alça de redimensionamento na borda direita */}
        <div
          onMouseDown={() => setIsResizing(true)}
          title="Arraste para redimensionar a barra lateral"
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#007acc]/60 transition-colors z-10"
        />

        {/* Menu de Contexto Customizado (Botão Direito) */}
        {contextMenu && (
          <div
            style={{
              top: `${Math.min(contextMenu.y, window.innerHeight - 340)}px`,
              left: `${Math.min(contextMenu.x, window.innerWidth - 220)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 min-w-[210px] py-1 bg-white dark:bg-[#252526] border border-[#d4d4d4] dark:border-[#454545] rounded-md shadow-2xl text-xs text-[#333333] dark:text-[#cccccc] select-none"
          >
            {/* Opções de Criação */}
            <button
              onClick={() => {
                const targetFolderId = contextMenu.chain
                  ? contextMenu.chain.leafFolder.id
                  : contextMenu.file
                  ? contextMenu.file.isFolder
                    ? contextMenu.file.id
                    : (contextMenu.file.parentId ?? null)
                  : null;
                handleStartCreate(false, targetFolderId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
            >
              <FilePlus className="w-3.5 h-3.5 text-[#007acc] dark:text-[#3794ff]" />
              <span>Novo Arquivo</span>
            </button>

            <button
              onClick={() => {
                const targetFolderId = contextMenu.chain
                  ? contextMenu.chain.leafFolder.id
                  : contextMenu.file
                  ? contextMenu.file.isFolder
                    ? contextMenu.file.id
                    : (contextMenu.file.parentId ?? null)
                  : null;
                handleStartCreate(true, targetFolderId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
              <span>Nova Pasta</span>
            </button>

            {/* Opções de Copiar Caminho / Duplicar */}
            {contextMenu.file && (
              <>
                <div className="my-1 border-t border-[#e5e5e5] dark:border-[#383838]" />

                <button
                  onClick={async () => {
                    const path = contextMenu.file?.path.replace(/^\//, '') || '';
                    await navigator.clipboard.writeText(path);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
                >
                  <Copy className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
                  <span>Copiar Caminho Relativo</span>
                </button>

                <button
                  onClick={async () => {
                    const name = contextMenu.file?.name || '';
                    await navigator.clipboard.writeText(name);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
                >
                  <Files className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
                  <span>Copiar Nome</span>
                </button>

                {!contextMenu.file.isFolder && (
                  <>
                    <button
                      onClick={() => {
                        if (contextMenu.file) handleDuplicateFile(contextMenu.file);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
                      <span>Duplicar Arquivo</span>
                    </button>

                    <button
                      onClick={() => {
                        if (contextMenu.file) handleDownloadSingleFile(contextMenu.file);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
                    >
                      <Download className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
                      <span>Baixar Arquivo</span>
                    </button>
                  </>
                )}

                <div className="my-1 border-t border-[#e5e5e5] dark:border-[#383838]" />

                <button
                  onClick={(e) => {
                    const target = contextMenu.chain ? contextMenu.chain.leafFolder : contextMenu.file;
                    if (target) handleStartRename(target, e);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
                  <span>Renomear</span>
                </button>

                <button
                  onClick={(e) => {
                    const target = contextMenu.chain ? contextMenu.chain.rootFolder : contextMenu.file;
                    if (target) handleDelete(target, e);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#e51400] hover:text-white text-rose-600 dark:text-rose-400 cursor-pointer transition-colors text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </>
            )}

            <div className="my-1 border-t border-[#e5e5e5] dark:border-[#383838]" />

            {/* Opções de Workspace */}
            <button
              onClick={() => {
                setContextMenu(null);
                refreshCurrentWorkspace();
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
              <span>Recarregar Workspace</span>
            </button>

            <button
              onClick={() => {
                setContextMenu(null);
                openWorkspacePicker();
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
              <span>Trocar Espaço de Trabalho...</span>
            </button>

            <div className="my-1 border-t border-[#e5e5e5] dark:border-[#383838]" />

            {/* Opção para Esconder Barra Lateral */}
            <button
              onClick={() => {
                setContextMenu(null);
                toggleSidebar();
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
              <span>Esconder Barra Lateral</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};
