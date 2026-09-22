import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useDialog } from '../../context/DialogContext';
import type { FileItem } from '../../types/editor';

interface CreatingState {
  parentId: string | null;
  isFolder: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  file?: FileItem | null;
}

export const Sidebar: React.FC = () => {
  const { showConfirm } = useDialog();
  const {
    files,
    activeFileId,
    openFile,
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

  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState<boolean>(false);

  const [creatingState, setCreatingState] = useState<CreatingState | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // Diretórios iniciam minimizados por padrão para evitar flood de arquivos
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());

  const sidebarRef = useRef<HTMLElement>(null);

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

  if (!isSidebarOpen) return null;

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
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
    if (creatingState && newItemName.trim()) {
      await createNewFile(newItemName.trim(), creatingState.isFolder, creatingState.parentId);
    }
    setCreatingState(null);
    setNewItemName('');
  };

  const handleCancelCreate = () => {
    setCreatingState(null);
    setNewItemName('');
  };

  const handleStartRename = (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(file.id);
    setEditingName(file.name);
  };

  const handleConfirmRename = async (fileId: string) => {
    if (editingName.trim()) {
      await renameFile(fileId, editingName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = async (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
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
          placeholder={creatingState?.isFolder ? 'nome da pasta...' : 'ex: main.c, utils.h'}
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

  const renderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const items = files.filter((f) => {
      if (parentId === null) {
        return !f.parentId || f.parentId === null;
      }
      return f.parentId === parentId;
    });

    const sorted = [...items].sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    return (
      <React.Fragment key={parentId ?? 'root'}>
        {creatingState?.parentId === parentId && renderCreationInput(depth)}

        {sorted.map((item) => {
          const isFolder = !!item.isFolder;
          const isExpanded = expandedFolders.has(item.id);
          const isActive = !isFolder && item.id === activeFileId;
          const isEditing = item.id === editingId;

          if (isFolder) {
            return (
              <div key={item.id}>
                <div
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
                    if (draggedFileId && draggedFileId !== item.id) {
                      setDragOverFolderId(item.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    if (dragOverFolderId === item.id) setDragOverFolderId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggedFileId && draggedFileId !== item.id) {
                      moveFileItem(draggedFileId, item.id);
                      setExpandedFolders((prev) => new Set(prev).add(item.id));
                    }
                    setDraggedFileId(null);
                    setDragOverFolderId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedFileId(null);
                    setDragOverFolderId(null);
                  }}
                  onClick={() => toggleFolder(item.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('theprog-close-context-menu'));
                    setContextMenu({ x: e.clientX, y: e.clientY, file: item });
                  }}
                  style={{ paddingLeft: `${8 + depth * 14}px` }}
                  className={`group flex items-center justify-between pr-2 py-1 cursor-pointer transition-colors ${
                    draggedFileId === item.id ? 'opacity-40' : ''
                  } ${
                    dragOverFolderId === item.id
                      ? 'bg-[#007acc]/20 dark:bg-[#007acc]/30 ring-1 ring-[#007acc]'
                      : 'hover:bg-[#e8e8e8] dark:hover:bg-[#2a2d2e]'
                  } text-[#333333] dark:text-[#cccccc]`}
                >
                  <div className="flex items-center space-x-1 truncate flex-1 mr-1">
                    <span className="p-0.5 text-[#616161] dark:text-[#888888] shrink-0">
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
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
                    ) : (
                      <span className="truncate font-medium">{item.name}</span>
                    )}
                  </div>

                  {/* Ações de Hover da Pasta */}
                  {!isEditing && (
                    <div className="hidden group-hover:flex items-center space-x-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCreate(false, item.id);
                        }}
                        title="Novo Arquivo nesta pasta"
                        className="p-1 hover:text-[#007acc] cursor-pointer"
                      >
                        <FilePlus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCreate(true, item.id);
                        }}
                        title="Nova Subpasta nesta pasta"
                        className="p-1 hover:text-[#007acc] cursor-pointer"
                      >
                        <FolderPlus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleStartRename(item, e)}
                        title="Renomear Pasta"
                        className="p-1 hover:text-[#007acc] cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(item, e)}
                        title="Excluir Pasta"
                        className="p-1 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Filhos da Pasta */}
                {isExpanded && renderTree(item.id, depth + 1)}
              </div>
            );
          }

          // Arquivo normal
          return (
            <div
              key={item.id}
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
              onClick={() => handleOpenFile(item.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('theprog-close-context-menu'));
                setContextMenu({ x: e.clientX, y: e.clientY, file: item });
              }}
              style={{ paddingLeft: `${18 + depth * 14}px` }}
              className={`group flex items-center justify-between pr-2 py-1 cursor-pointer transition-colors ${
                draggedFileId === item.id ? 'opacity-40' : ''
              } ${
                isActive
                  ? 'bg-[#e4e6f1] dark:bg-[#37373d] text-black dark:text-white font-medium border-l-2 border-[#007acc]'
                  : 'hover:bg-[#e8e8e8] dark:hover:bg-[#2a2d2e] text-[#333333] dark:text-[#cccccc]'
              }`}
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
                  <span className="truncate">{item.name}</span>
                )}
              </div>

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
      </React.Fragment>
    );
  };

  if (!isSidebarOpen) return null;

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
        {/* Topo do Explorador com botões globais e de colapsar */}
        <div className="h-9 px-3 flex items-center justify-between font-semibold tracking-wider text-[11px] text-[#616161] dark:text-[#888888] border-b border-[#e5e5e5] dark:border-[#202020]">
          <span className="truncate mr-1">EXPLORADOR</span>
          <div className="flex items-center space-x-1 shrink-0">
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
              onClick={openWorkspacePicker}
              title="Trocar Pasta / Espaço de Trabalho"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleSidebar}
              title="Esconder Barra Lateral"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer ml-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      {/* Seção Workspace Hierárquica */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setIsDragOverRoot(true);
        }}
        onDragLeave={() => {
          setIsDragOverRoot(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedFileId) {
            moveFileItem(draggedFileId, null);
          }
          setDraggedFileId(null);
          setDragOverFolderId(null);
          setIsDragOverRoot(false);
        }}
        className={`flex-1 overflow-y-auto transition-colors ${
          isDragOverRoot && !dragOverFolderId ? 'bg-[#007acc]/10 ring-1 ring-[#007acc]' : ''
        }`}
      >
        <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-[#333333] dark:text-[#aaaaaa] hover:bg-[#e8e8e8] dark:hover:bg-[#2a2d2e] group">
          <div
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            className="flex items-center space-x-1.5 cursor-pointer truncate flex-1 min-w-0"
          >
            {isSectionOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              openWorkspacePicker();
            }}
            title="Trocar Pasta / Espaço de Trabalho"
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white transition-opacity shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>

        {isSectionOpen && (
          <div className="py-1 min-h-[50px]">
            {renderTree(null, 0)}
            {files.length === 0 && !creatingState && (
              <div className="p-4 text-center text-xs text-[#888888] space-y-2">
                <p>Esta pasta está vazia.</p>
                <button
                  onClick={() => handleStartCreate(false, null)}
                  className="px-2.5 py-1 rounded bg-[#007acc] text-white text-[11px] font-medium hover:bg-[#0062a3] cursor-pointer"
                >
                  Criar Arquivo
                </button>
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
            top: `${Math.min(contextMenu.y, window.innerHeight - 240)}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 210)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 min-w-[195px] py-1 bg-white dark:bg-[#252526] border border-[#d4d4d4] dark:border-[#454545] rounded-md shadow-2xl text-xs text-[#333333] dark:text-[#cccccc] select-none"
        >
          {/* Opções de Criação */}
          <button
            onClick={() => {
              const pid = contextMenu.file
                ? contextMenu.file.isFolder
                  ? contextMenu.file.id
                  : (contextMenu.file.parentId ?? null)
                : null;
              handleStartCreate(false, pid);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
          >
            <FilePlus className="w-3.5 h-3.5 text-[#007acc] dark:text-[#3794ff]" />
            <span>Novo Arquivo</span>
          </button>

          <button
            onClick={() => {
              const pid = contextMenu.file
                ? contextMenu.file.isFolder
                  ? contextMenu.file.id
                  : (contextMenu.file.parentId ?? null)
                : null;
              handleStartCreate(true, pid);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
            <span>Nova Pasta</span>
          </button>

          {/* Opções do Item Clicado (Renomear / Excluir) */}
          {contextMenu.file && (
            <>
              <div className="my-1 border-t border-[#e5e5e5] dark:border-[#383838]" />
              <button
                onClick={(e) => {
                  if (contextMenu.file) {
                    handleStartRename(contextMenu.file, e);
                  }
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#616161] dark:text-[#aaaaaa]" />
                <span>Renomear</span>
              </button>
              <button
                onClick={(e) => {
                  if (contextMenu.file) {
                    handleDelete(contextMenu.file, e);
                  }
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

