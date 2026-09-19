import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import type {
  FileItem,
  EditorTab,
  VMStatus,
  SupportedLanguage,
  ActiveWorkspace,
  RecentWorkspace,
} from '../types/editor';
import {
  loadAllFiles,
  saveFileToStorage,
  deleteFileFromStorage,
  getRecentWorkspaces,
  saveRecentWorkspace,
  removeRecentWorkspace,
  updateWorkspaceLastOpened,
} from '../services/storage';
import {
  pickDirectory,
  readDirectoryTree,
  saveFileToDisk,
  createFileOnDisk,
  createFolderOnDisk,
  deleteFromDisk,
  renameOnDisk,
  verifyPermission,
  scanDirectorySnapshot,
  startDirectoryAutoSync,
  getFileHandleByPath,
  isRecentInternalWrite,
  recordInternalWrite,
} from '../services/localFs';
import { vmManager } from '../services/vmManager';
import { formatCode } from '../utils/formatter';
import {
  preloadCompiler,
  subscribeCompilerProgress,
  getCompilerProgress,
  type CompilerProgress,
} from '../services/cCompiler';

export type SystemStatus = 'loading' | 'ready' | 'running' | 'error';
export type AppScreen = 'welcome' | 'editor';

interface EditorContextType {
  files: FileItem[];
  activeFileId: string | null;
  activeFile: FileItem | null;
  tabs: EditorTab[];
  vmStatus: VMStatus;
  vmStatusMessage: string;
  compilerProgress: CompilerProgress;
  preloadCompiler: () => Promise<void>;
  isSystemReady: boolean;
  systemStatus: SystemStatus;
  systemProgressPercent: number;
  systemStatusMessage: string;
  isTerminalMinimized: boolean;
  setIsTerminalMinimized: (min: boolean | ((prev: boolean) => boolean)) => void;
  isLinuxLoading: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  openFile: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  createNewFile: (name: string, isFolder?: boolean, parentId?: string | null) => Promise<string>;
  deleteFile: (fileId: string) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
  downloadWorkspaceZip: () => Promise<void>;
  runActiveFile: (overrideContent?: string) => void;
  formatActiveFile: () => void;
  resetTerminal: () => void;
  stopExecution: () => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  moveFileItem: (fileId: string, newParentId: string | null) => Promise<void>;
  fontSize: number;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  terminalFontSize: number;
  setTerminalFontSize: (size: number) => void;
  increaseTerminalFontSize: () => void;
  decreaseTerminalFontSize: () => void;
  resetTerminalFontSize: () => void;
  compilerFlags: string[];
  setCompilerFlags: (flags: string[]) => void;
  autoSave: boolean;
  setAutoSave: (enabled: boolean) => void;
  autoSaveDelay: number;
  setAutoSaveDelay: (delay: number) => void;
  saveActiveFile: () => Promise<void>;

  // Telas e Workspaces
  currentScreen: AppScreen;
  hasEnteredEditorSession: boolean;
  openWelcomeScreen: () => void;
  returnToEditor: () => void;
  activeWorkspace: ActiveWorkspace;
  recentWorkspaces: RecentWorkspace[];
  isWorkspacePickerOpen: boolean;
  openWorkspacePicker: () => void;
  closeWorkspacePicker: () => void;
  openLocalFolder: () => Promise<void>;
  openSandboxWorkspace: () => Promise<void>;
  selectRecentWorkspace: (workspace: RecentWorkspace) => Promise<void>;
  removeRecentWorkspaceItem: (id: string) => Promise<void>;
  refreshCurrentWorkspace: () => Promise<void>;
  alwaysOpenLast: boolean;
  setAlwaysOpenLast: (enabled: boolean) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [vmStatus, setVmStatus] = useState<VMStatus>('idle');
  const [vmStatusMessage, setVmStatusMessage] = useState<string>('Inicializando Linux...');
  const [compilerProgress, setCompilerProgress] = useState<CompilerProgress>(getCompilerProgress());
  
  // Telas
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('welcome');
  const [hasEnteredEditorSession, setHasEnteredEditorSession] = useState<boolean>(false);

  // Workspaces
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace>({
    type: 'sandbox',
    name: 'Sandbox Virtual',
  });
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const [isWorkspacePickerOpen, setIsWorkspacePickerOpen] = useState<boolean>(false);

  const [isTerminalMinimized, setIsTerminalMinimizedState] = useState<boolean>(() => {
    const saved = localStorage.getItem('theprog_terminal_minimized');
    return saved !== null ? saved === 'true' : true;
  });

  const setIsTerminalMinimized = useCallback((min: boolean | ((prev: boolean) => boolean)) => {
    setIsTerminalMinimizedState((prev) => {
      const next = typeof min === 'function' ? min(prev) : min;
      localStorage.setItem('theprog_terminal_minimized', String(next));
      return next;
    });
  }, []);

  const [isLinuxLoading, setIsLinuxLoading] = useState<boolean>(false);

  const [isSidebarOpen, setIsSidebarOpenState] = useState<boolean>(() => {
    const saved = localStorage.getItem('theprog_sidebar_open');
    return saved !== null ? saved === 'true' : false;
  });

  const setIsSidebarOpen = useCallback((open: boolean | ((prev: boolean) => boolean)) => {
    setIsSidebarOpenState((prev) => {
      const next = typeof open === 'function' ? open(prev) : open;
      localStorage.setItem('theprog_sidebar_open', String(next));
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, [setIsSidebarOpen]);

  const [isStorageLoaded, setIsStorageLoaded] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('theprog_sidebar_width');
    return saved ? Math.max(180, Math.min(600, parseInt(saved, 10))) : 240;
  });

  // Tamanho da fonte do Monaco Editor
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('theprog_editor_font_size');
    return saved ? Math.max(10, Math.min(32, parseInt(saved, 10))) : 14;
  });

  const handleSetFontSize = useCallback((size: number) => {
    const clamped = Math.max(10, Math.min(32, size));
    setFontSize(clamped);
    localStorage.setItem('theprog_editor_font_size', clamped.toString());
  }, []);

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.min(32, prev + 1);
      localStorage.setItem('theprog_editor_font_size', next.toString());
      return next;
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const next = Math.max(10, prev - 1);
      localStorage.setItem('theprog_editor_font_size', next.toString());
      return next;
    });
  }, []);

  const resetFontSize = useCallback(() => {
    setFontSize(14);
    localStorage.setItem('theprog_editor_font_size', '14');
  }, []);

  // Tamanho da fonte do Terminal (Padrão 14)
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('theprog_terminal_font_size');
    return saved ? Math.max(10, Math.min(32, parseInt(saved, 10))) : 14;
  });

  const handleSetTerminalFontSize = useCallback((size: number) => {
    const clamped = Math.max(10, Math.min(32, size));
    setTerminalFontSize(clamped);
    localStorage.setItem('theprog_terminal_font_size', clamped.toString());
  }, []);

  const increaseTerminalFontSize = useCallback(() => {
    setTerminalFontSize((prev) => {
      const next = Math.min(32, prev + 1);
      localStorage.setItem('theprog_terminal_font_size', next.toString());
      return next;
    });
  }, []);

  const decreaseTerminalFontSize = useCallback(() => {
    setTerminalFontSize((prev) => {
      const next = Math.max(10, prev - 1);
      localStorage.setItem('theprog_terminal_font_size', next.toString());
      return next;
    });
  }, []);

  const resetTerminalFontSize = useCallback(() => {
    setTerminalFontSize(14);
    localStorage.setItem('theprog_terminal_font_size', '14');
  }, []);

  // Flags customizadas do compilador Clang (suporte dual C e C++ sem forçar padrão exclusivo de C)
  const [compilerFlags, setCompilerFlagsState] = useState<string[]>(() => {
    const defaultFlags = ['-O0', '-Wall', '-Wextra'];
    const saved = localStorage.getItem('theprog_compiler_flags');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migra configurações antigas que continham -std=c17
          const cleaned = parsed.filter((f) => f !== '-std=c17');
          if (cleaned.length === 0) return defaultFlags;
          localStorage.setItem('theprog_compiler_flags', JSON.stringify(cleaned));
          return cleaned;
        }
      } catch {}
    }
    return defaultFlags;
  });

  const setCompilerFlags = useCallback((flags: string[]) => {
    setCompilerFlagsState(flags);
    localStorage.setItem('theprog_compiler_flags', JSON.stringify(flags));
  }, []);

  // Salvamento Automático Configurável (padrão 1500ms debounce aumentado para estabilidade no disco)
  const [autoSave, setAutoSaveState] = useState<boolean>(() => {
    const saved = localStorage.getItem('theprog_autosave');
    return saved !== null ? saved === 'true' : true;
  });

  const [autoSaveDelay, setAutoSaveDelayState] = useState<number>(() => {
    const saved = localStorage.getItem('theprog_autosave_delay');
    return saved !== null ? Math.max(500, parseInt(saved, 10)) : 1500;
  });

  const setAutoSave = useCallback((enabled: boolean) => {
    setAutoSaveState(enabled);
    localStorage.setItem('theprog_autosave', String(enabled));
  }, []);

  const setAutoSaveDelay = useCallback((delay: number) => {
    const clamped = Math.max(500, Math.min(10000, delay));
    setAutoSaveDelayState(clamped);
    localStorage.setItem('theprog_autosave_delay', String(clamped));
  }, []);

  const [alwaysOpenLast, setAlwaysOpenLastState] = useState<boolean>(() => {
    return localStorage.getItem('theprog_always_open_last_workspace') === 'true';
  });

  const setAlwaysOpenLast = useCallback((enabled: boolean) => {
    setAlwaysOpenLastState(enabled);
    localStorage.setItem('theprog_always_open_last_workspace', String(enabled));
  }, []);

  const saveTimeouts = useRef<Map<string, any>>(new Map());
  const currentWsKeyRef = useRef<string>('');

  const handleSetSidebarWidth = (w: number) => {
    const clamped = Math.max(180, Math.min(600, w));
    setSidebarWidth(clamped);
    localStorage.setItem('theprog_sidebar_width', clamped.toString());
  };

  const detectLanguage = (filename: string): SupportedLanguage => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.c')) return 'c';
    if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) return 'cpp';
    if (lower.endsWith('.h') || lower.endsWith('.hpp')) return 'h';
    return 'plaintext';
  };

  // Carrega Workspace Local (diretório físico no OS)
  const loadLocalWorkspace = useCallback(async (dirHandle: FileSystemDirectoryHandle) => {
    saveTimeouts.current.forEach((timer) => clearTimeout(timer));
    saveTimeouts.current.clear();
    setIsStorageLoaded(false);

    const wsName = dirHandle.name;
    const wsKey = `local_${wsName}`;

    const loadedFiles = await readDirectoryTree(dirHandle);
    setFiles(loadedFiles);

    // Recupera sessão anterior isolada para este workspace específico
    const savedSessionJson = localStorage.getItem(`theprog_ws_session_${wsKey}`);
    let restoredTabs: EditorTab[] = [];
    let restoredActiveFileId: string | null = null;

    if (savedSessionJson) {
      try {
        const session: {
          openTabPaths: string[];
          activeFilePath: string | null;
          isTerminalMinimized?: boolean;
          isSidebarOpen?: boolean;
          sidebarWidth?: number;
        } = JSON.parse(savedSessionJson);

        if (Array.isArray(session.openTabPaths)) {
          restoredTabs = session.openTabPaths
            .map((p) => loadedFiles.find((f) => f.path === p && !f.isFolder))
            .filter((f): f is FileItem => !!f)
            .map((f) => ({
              fileId: f.id,
              filePath: f.path,
              title: f.name,
              language: f.language,
            }));
        }

        if (session.activeFilePath) {
          const foundActive = loadedFiles.find((f) => f.path === session.activeFilePath && !f.isFolder);
          if (foundActive && restoredTabs.some((t) => t.fileId === foundActive.id)) {
            restoredActiveFileId = foundActive.id;
          }
        }

        if (!restoredActiveFileId && restoredTabs.length > 0) {
          restoredActiveFileId = restoredTabs[restoredTabs.length - 1].fileId;
        }

        if (session.isTerminalMinimized !== undefined) {
          setIsTerminalMinimizedState(session.isTerminalMinimized);
          localStorage.setItem('theprog_terminal_minimized', String(session.isTerminalMinimized));
        }
        if (session.isSidebarOpen !== undefined) {
          setIsSidebarOpenState(session.isSidebarOpen);
          localStorage.setItem('theprog_sidebar_open', String(session.isSidebarOpen));
        }
        if (session.sidebarWidth !== undefined) {
          const clampedW = Math.max(180, Math.min(600, session.sidebarWidth));
          setSidebarWidth(clampedW);
          localStorage.setItem('theprog_sidebar_width', String(clampedW));
        }
      } catch (err) {
        console.warn('Erro ao restaurar sessão do workspace local:', err);
      }
    }

    // Se é a primeira vez que a pasta é aberta (sem sessão anterior salva), exibe NENHUM arquivo aberto
    setTabs(restoredTabs);
    setActiveFileId(restoredActiveFileId);

    setActiveWorkspace({
      type: 'local',
      name: wsName,
      handle: dirHandle,
    });

    const recentItem: RecentWorkspace = {
      id: 'local-' + wsName,
      name: wsName,
      type: 'local',
      path: 'Diretório local do computador',
      handle: dirHandle,
      lastOpened: Date.now(),
    };

    await saveRecentWorkspace(recentItem);
    const updatedRecents = await getRecentWorkspaces();
    setRecentWorkspaces(updatedRecents);
    localStorage.setItem('theprog_last_workspace_id', recentItem.id);
    setIsWorkspacePickerOpen(false);
    setHasEnteredEditorSession(true);
    setCurrentScreen('editor');
    currentWsKeyRef.current = wsKey;
    setIsStorageLoaded(true);

    preloadCompiler().catch((err) => {
      console.warn('Pré-carregamento do compilador adiado:', err);
    });
  }, []);

  // Carrega Workspace Sandbox (Virtual no IndexedDB)
  const loadSandboxWorkspace = useCallback(async () => {
    saveTimeouts.current.forEach((timer) => clearTimeout(timer));
    saveTimeouts.current.clear();
    setIsStorageLoaded(false);

    const wsKey = 'sandbox';

    const loadedFiles = await loadAllFiles();
    setFiles(loadedFiles);
    loadedFiles.forEach((f) => {
      if (!f.isFolder && f.content) {
        vmManager.syncFile(f.name, f.content);
      }
    });

    const savedSessionJson = localStorage.getItem(`theprog_ws_session_${wsKey}`);
    let restoredTabs: EditorTab[] = [];
    let restoredActiveFileId: string | null = null;

    if (savedSessionJson) {
      try {
        const session: {
          openTabPaths: string[];
          activeFilePath: string | null;
          isTerminalMinimized?: boolean;
          isSidebarOpen?: boolean;
          sidebarWidth?: number;
        } = JSON.parse(savedSessionJson);

        if (Array.isArray(session.openTabPaths)) {
          restoredTabs = session.openTabPaths
            .map((p) => loadedFiles.find((f) => f.path === p && !f.isFolder))
            .filter((f): f is FileItem => !!f)
            .map((f) => ({
              fileId: f.id,
              filePath: f.path,
              title: f.name,
              language: f.language,
            }));
        }

        if (session.activeFilePath) {
          const foundActive = loadedFiles.find((f) => f.path === session.activeFilePath && !f.isFolder);
          if (foundActive && restoredTabs.some((t) => t.fileId === foundActive.id)) {
            restoredActiveFileId = foundActive.id;
          }
        }

        if (!restoredActiveFileId && restoredTabs.length > 0) {
          restoredActiveFileId = restoredTabs[restoredTabs.length - 1].fileId;
        }

        if (session.isTerminalMinimized !== undefined) {
          setIsTerminalMinimizedState(session.isTerminalMinimized);
          localStorage.setItem('theprog_terminal_minimized', String(session.isTerminalMinimized));
        }
        if (session.isSidebarOpen !== undefined) {
          setIsSidebarOpenState(session.isSidebarOpen);
          localStorage.setItem('theprog_sidebar_open', String(session.isSidebarOpen));
        }
        if (session.sidebarWidth !== undefined) {
          const clampedW = Math.max(180, Math.min(600, session.sidebarWidth));
          setSidebarWidth(clampedW);
          localStorage.setItem('theprog_sidebar_width', String(clampedW));
        }
      } catch (err) {
        console.warn('Erro ao restaurar sessão sandbox:', err);
      }
    } else {
      // Compatibilidade retroativa com chaves legadas ou template padrão
      const savedTabsJson = localStorage.getItem('theprog_open_tabs');
      const savedActiveId = localStorage.getItem('theprog_active_file_id');

      if (savedTabsJson) {
        try {
          const parsedIds: string[] = JSON.parse(savedTabsJson);
          if (Array.isArray(parsedIds)) {
            restoredTabs = parsedIds
              .map((id) => loadedFiles.find((f) => f.id === id && !f.isFolder))
              .filter((f): f is FileItem => !!f)
              .map((f) => ({
                fileId: f.id,
                filePath: f.path,
                title: f.name,
                language: f.language,
              }));
          }
        } catch {}
      }

      if (restoredTabs.length > 0) {
        if (savedActiveId && restoredTabs.some((t) => t.fileId === savedActiveId)) {
          restoredActiveFileId = savedActiveId;
        } else {
          restoredActiveFileId = restoredTabs[restoredTabs.length - 1].fileId;
        }
      } else {
        const initialFile = loadedFiles.find((f) => !f.isFolder);
        if (initialFile) {
          restoredActiveFileId = initialFile.id;
          restoredTabs = [
            {
              fileId: initialFile.id,
              filePath: initialFile.path,
              title: initialFile.name,
              language: initialFile.language,
            },
          ];
        }
      }
    }

    setTabs(restoredTabs);
    setActiveFileId(restoredActiveFileId);

    setActiveWorkspace({
      type: 'sandbox',
      name: 'Sandbox Virtual',
    });

    await updateWorkspaceLastOpened('sandbox');
    const updatedRecents = await getRecentWorkspaces();
    setRecentWorkspaces(updatedRecents);
    localStorage.setItem('theprog_last_workspace_id', 'sandbox');
    setIsWorkspacePickerOpen(false);
    setHasEnteredEditorSession(true);
    setCurrentScreen('editor');
    currentWsKeyRef.current = wsKey;
    setIsStorageLoaded(true);

    preloadCompiler().catch((err) => {
      console.warn('Pré-carregamento do compilador adiado:', err);
    });
  }, []);

  const openLocalFolder = useCallback(async () => {
    const dirHandle = await pickDirectory();
    await loadLocalWorkspace(dirHandle);
  }, [loadLocalWorkspace]);

  const selectRecentWorkspace = useCallback(
    async (workspace: RecentWorkspace) => {
      if (workspace.type === 'sandbox') {
        await loadSandboxWorkspace();
        return;
      }

      if (workspace.handle) {
        const hasPerm = await verifyPermission(workspace.handle, true);
        if (!hasPerm) {
          throw new Error(`Permissão de acesso negada pelo navegador para a pasta "${workspace.name}".`);
        }
        await loadLocalWorkspace(workspace.handle);
        return;
      }

      await openLocalFolder();
    },
    [loadSandboxWorkspace, loadLocalWorkspace, openLocalFolder]
  );

  const removeRecentWorkspaceItem = useCallback(async (id: string) => {
    await removeRecentWorkspace(id);
    const updated = await getRecentWorkspaces();
    setRecentWorkspaces(updated);
  }, []);

  const refreshCurrentWorkspace = useCallback(async () => {
    if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
      const loadedFiles = await readDirectoryTree(activeWorkspace.handle);
      setFiles(loadedFiles);
    } else {
      const loadedFiles = await loadAllFiles();
      setFiles(loadedFiles);
    }
  }, [activeWorkspace]);

  const openWorkspacePicker = useCallback(() => {
    setCurrentScreen('welcome');
  }, []);

  const closeWorkspacePicker = useCallback(() => {
    setIsWorkspacePickerOpen(false);
  }, []);

  const openWelcomeScreen = useCallback(() => {
    setCurrentScreen('welcome');
  }, []);

  const returnToEditor = useCallback(() => {
    setHasEnteredEditorSession(true);
    setCurrentScreen('editor');
  }, []);

  // Download do Workspace completo como arquivo .zip
  const downloadWorkspaceZip = useCallback(async () => {
    try {
      const zip = new JSZip();
      files.forEach((f) => {
        if (!f.isFolder) {
          const cleanPath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
          zip.file(cleanPath, f.content || '');
        }
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeWorkspace.name.toLowerCase().replace(/\s+/g, '-')}-workspace.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar ZIP:', err);
    }
  }, [files, activeWorkspace.name]);

  // Inicialização da aplicação: gerencia workspaces recentes, decisão de tela e pré-carrega o sistema
  useEffect(() => {
    // Inicia imediatamente o carregamento do compilador Clang e Linux upfront
    preloadCompiler().catch((err) => {
      console.warn('Pré-carregamento inicial do compilador adiado:', err);
    });

    getRecentWorkspaces().then(async (recents) => {
      setRecentWorkspaces(recents);

      const alwaysOpenLast = localStorage.getItem('theprog_always_open_last_workspace') === 'true';
      const lastWorkspaceId = localStorage.getItem('theprog_last_workspace_id');

      if (alwaysOpenLast && lastWorkspaceId) {
        if (lastWorkspaceId === 'sandbox') {
          await loadSandboxWorkspace();
          return;
        }
        const found = recents.find((w) => w.id === lastWorkspaceId && w.type === 'local' && w.handle);
        if (found && found.handle) {
          const hasPerm = await verifyPermission(found.handle, true);
          if (hasPerm) {
            await loadLocalWorkspace(found.handle);
            return;
          }
        }
      }

      // Por padrão: exibe tela de boas-vindas ('welcome') de forma limpa e autônoma
      setCurrentScreen('welcome');
      setIsLinuxLoading(false);
    });

    const unsubscribeStatus = vmManager.subscribeStatus((status, message) => {
      setVmStatus(status);
      if (message) setVmStatusMessage(message);
      if (status === 'booting' || status === 'downloading') {
        setIsLinuxLoading(true);
      } else if (status === 'ready') {
        setIsLinuxLoading(false);
      }
    });

    const unsubscribeCompiler = subscribeCompilerProgress((prog) => {
      setCompilerProgress(prog);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeCompiler();
    };
  }, [loadLocalWorkspace, loadSandboxWorkspace]);

  // Observador e Auto-Sync inteligente de alterações externas no diretório físico do OS
  useEffect(() => {
    if (currentScreen !== 'editor' || activeWorkspace.type !== 'local' || !activeWorkspace.handle) {
      return;
    }

    const dirHandle = activeWorkspace.handle;

    const performSync = async () => {
      try {
        const snapshot = await scanDirectorySnapshot(dirHandle);

        setFiles((prevFiles) => {
          let hasModifications = false;
          const updated = [...prevFiles];
          const currentPaths = new Set(prevFiles.map((f) => f.path));

          // 1. Detectar novos arquivos ou subpastas criadas pelo SO
          for (const [snapPath, meta] of snapshot.entries()) {
            // Ignora arquivos recém-gravados internamente pelo TheProg Editor para evitar duplicações/race conditions
            if (isRecentInternalWrite(snapPath)) {
              continue;
            }

            if (!currentPaths.has(snapPath)) {
              hasModifications = true;
              const parts = snapPath.split('/').filter(Boolean);
              const name = parts[parts.length - 1];
              const parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : null;
              const parent = parentPath ? prevFiles.find((f) => f.path === parentPath) : null;

              const newItem: FileItem = {
                id: 'local-' + snapPath.replace(/[^a-zA-Z0-9_-]/g, '_'),
                name,
                path: snapPath,
                isFolder: meta.isFolder,
                parentId: parent ? parent.id : null,
                language: detectLanguage(name),
                updatedAt: meta.lastModified || Date.now(),
                content: meta.isFolder ? undefined : '',
              };
              updated.push(newItem);

              if (!meta.isFolder && meta.size <= 5 * 1024 * 1024) {
                getFileHandleByPath(dirHandle, snapPath)
                  .then((fh) => fh?.getFile())
                  .then((file) => file?.text())
                  .then((content) => {
                    if (content !== undefined) {
                      setFiles((curr) =>
                        curr.map((f) => (f.path === snapPath ? { ...f, content } : f))
                      );
                    }
                  })
                  .catch(() => {});
              }
            }
          }

          // 2. Detectar arquivos ou pastas removidas pelo SO
          const snapshotPaths = new Set(snapshot.keys());
          const finalFiles: FileItem[] = [];
          for (const f of updated) {
            if (snapshotPaths.has(f.path) || isRecentInternalWrite(f.path)) {
              finalFiles.push(f);
            } else {
              hasModifications = true;
              setTabs((prevTabs) => prevTabs.filter((t) => t.fileId !== f.id && t.filePath !== f.path));
            }
          }

          // 3. Detectar arquivos modificados externamente no disco
          for (let i = 0; i < finalFiles.length; i++) {
            const f = finalFiles[i];
            if (f.isFolder) continue;

            const snap = snapshot.get(f.path);
            if (!snap) continue;

            if (snap.lastModified > f.updatedAt && !isRecentInternalWrite(f.path)) {
              const isDirty = tabs.some((t) => (t.fileId === f.id || t.filePath === f.path) && t.isDirty);
              if (!isDirty) {
                hasModifications = true;
                finalFiles[i] = {
                  ...f,
                  updatedAt: snap.lastModified,
                };
                getFileHandleByPath(dirHandle, f.path)
                  .then((fh) => fh?.getFile())
                  .then((file) => file?.text())
                  .then((content) => {
                    if (content !== undefined) {
                      setFiles((curr) =>
                        curr.map((item) => (item.id === f.id ? { ...item, content, updatedAt: snap.lastModified } : item))
                      );
                    }
                  })
                  .catch(() => {});
              }
            }
          }

          return hasModifications ? finalFiles : prevFiles;
        });
      } catch (err) {
        console.warn('Erro ao sincronizar automaticamente diretório local:', err);
      }
    };

    const cleanup = startDirectoryAutoSync(dirHandle, performSync);
    return cleanup;
  }, [currentScreen, activeWorkspace, tabs]);

  const activeFile = files.find((f) => f.id === activeFileId) || null;

  // Persiste a sessão do workspace atual (abas abertas, arquivo ativo, terminal, sidebar) de forma 100% isolada por projeto
  useEffect(() => {
    if (!isStorageLoaded || !hasEnteredEditorSession) return;
    const wsKey = activeWorkspace.type === 'local' ? `local_${activeWorkspace.name}` : 'sandbox';
    if (currentWsKeyRef.current !== wsKey) return;

    const tabPaths = tabs.map((t) => t.filePath).filter(Boolean);
    const activeFilePath = activeFile ? activeFile.path : null;

    const sessionData = {
      openTabPaths: tabPaths,
      activeFilePath,
      isTerminalMinimized,
      isSidebarOpen,
      sidebarWidth,
    };

    localStorage.setItem(`theprog_ws_session_${wsKey}`, JSON.stringify(sessionData));

    // Mantém compatibilidade com chaves legadas de sandbox
    if (activeWorkspace.type === 'sandbox') {
      const tabIds = tabs.map((t) => t.fileId);
      localStorage.setItem('theprog_open_tabs', JSON.stringify(tabIds));
      if (activeFileId) {
        localStorage.setItem('theprog_active_file_id', activeFileId);
      } else {
        localStorage.removeItem('theprog_active_file_id');
      }
    }
  }, [
    tabs,
    activeFileId,
    activeFile,
    isTerminalMinimized,
    isSidebarOpen,
    sidebarWidth,
    isStorageLoaded,
    hasEnteredEditorSession,
    activeWorkspace,
  ]);

  const openFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file || file.isFolder) return;

      setActiveFileId(file.id);

      setTabs((prevTabs) => {
        const alreadyOpen = prevTabs.find((t) => t.fileId === file.id || t.filePath === file.path);
        if (alreadyOpen) {
          if (alreadyOpen.fileId !== file.id) {
            return prevTabs.map((t) => (t.filePath === file.path ? { ...t, fileId: file.id } : t));
          }
          return prevTabs;
        }

        return [
          ...prevTabs,
          {
            fileId: file.id,
            filePath: file.path,
            title: file.name,
            language: file.language,
          },
        ];
      });
    },
    [files]
  );

  const closeTab = useCallback(
    (fileId: string) => {
      setTabs((prevTabs) => {
        const targetTab = prevTabs.find((t) => t.fileId === fileId);
        const nextTabs = prevTabs.filter(
          (t) => t.fileId !== fileId && (!targetTab || t.filePath !== targetTab.filePath)
        );
        if (activeFileId === fileId || (targetTab && activeFile?.path === targetTab.filePath)) {
          if (nextTabs.length > 0) {
            setActiveFileId(nextTabs[nextTabs.length - 1].fileId);
          } else {
            setActiveFileId(null);
          }
        }
        return nextTabs;
      });
    },
    [activeFileId, activeFile]
  );

  const saveActiveFile = useCallback(async () => {
    if (!activeFile || activeFile.isFolder) return;
    const fileId = activeFile.id;

    if (saveTimeouts.current.has(fileId)) {
      clearTimeout(saveTimeouts.current.get(fileId));
      saveTimeouts.current.delete(fileId);
    }

    const contentToSave = activeFile.content || '';
    if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
      await saveFileToDisk(activeWorkspace.handle, activeFile.path, contentToSave).catch((err) => {
        console.error('Erro ao salvar no disco:', err);
      });
    } else {
      await saveFileToStorage(activeFile);
    }
    vmManager.syncFile(activeFile.name, contentToSave);

    setTabs((prev) =>
      prev.map((t) => (t.fileId === fileId ? { ...t, isDirty: false } : t))
    );
  }, [activeFile, activeWorkspace]);

  const updateFileContent = useCallback((fileId: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileId) {
          return { ...f, content, updatedAt: Date.now() };
        }
        return f;
      })
    );

    setTabs((prev) =>
      prev.map((t) => (t.fileId === fileId ? { ...t, isDirty: true } : t))
    );

    if (saveTimeouts.current.has(fileId)) {
      clearTimeout(saveTimeouts.current.get(fileId));
      saveTimeouts.current.delete(fileId);
    }

    // Se o usuário desativou o salvamento automático, mantém a aba como isDirty e aguarda Ctrl+S ou Run
    if (!autoSave) {
      return;
    }

    const timer = setTimeout(async () => {
      setFiles((currentFiles) => {
        const fileToSave = currentFiles.find((f) => f.id === fileId);
        if (fileToSave) {
          if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
            saveFileToDisk(activeWorkspace.handle, fileToSave.path, content).catch((err) => {
              console.error('Erro ao salvar no disco:', err);
            });
          } else {
            saveFileToStorage(fileToSave);
          }
          vmManager.syncFile(fileToSave.name, content);
        }
        return currentFiles;
      });

      setTabs((prev) =>
        prev.map((t) => (t.fileId === fileId ? { ...t, isDirty: false } : t))
      );
      saveTimeouts.current.delete(fileId);
    }, autoSaveDelay);

    saveTimeouts.current.set(fileId, timer);
  }, [activeWorkspace, autoSave, autoSaveDelay]);

  const createNewFile = useCallback(
    async (name: string, isFolder: boolean = false, parentId: string | null = null): Promise<string> => {
      const cleanName = name.trim();
      const language = detectLanguage(cleanName);

      let filePath = '/' + cleanName;
      if (parentId) {
        const parent = files.find((f) => f.id === parentId);
        if (parent) {
          filePath = `${parent.path}/${cleanName}`;
        }
      }

      // ID determinístico para arquivos locais do computador (garante sincronização perfeita com scanner de disco)
      const id =
        activeWorkspace.type === 'local'
          ? 'local-' + filePath.replace(/[^a-zA-Z0-9_-]/g, '_')
          : 'f-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

      const newFile: FileItem = {
        id,
        name: cleanName,
        path: filePath,
        isFolder,
        parentId,
        language,
        updatedAt: Date.now(),
        content: isFolder ? undefined : '',
      };

      // Notifica o sistema de auto-sync de gravação interna prévia para evitar race conditions no disco
      recordInternalWrite(filePath);

      if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
        if (isFolder) {
          await createFolderOnDisk(activeWorkspace.handle, filePath);
        } else {
          await createFileOnDisk(activeWorkspace.handle, filePath);
        }
      } else {
        await saveFileToStorage(newFile);
      }

      recordInternalWrite(filePath);

      setFiles((prev) => {
        const exists = prev.some((f) => f.id === id || f.path === filePath);
        if (exists) {
          return prev.map((f) =>
            f.id === id || f.path === filePath ? { ...newFile, ...f, id, path: filePath, name: cleanName } : f
          );
        }
        return [...prev, newFile];
      });

      if (!isFolder) {
        vmManager.syncFile(newFile.name, newFile.content || '');
        setActiveFileId(id);
        setTabs((prevTabs) => {
          const alreadyOpen = prevTabs.find((t) => t.fileId === id || t.filePath === filePath);
          if (alreadyOpen) {
            return prevTabs.map((t) =>
              t.fileId === id || t.filePath === filePath
                ? { ...t, fileId: id, filePath, title: cleanName, language }
                : t
            );
          }
          return [
            ...prevTabs,
            {
              fileId: id,
              filePath,
              title: cleanName,
              language,
            },
          ];
        });
      }

      return id;
    },
    [files, activeWorkspace]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;

      const idsToDelete: string[] = [fileId];
      const findDescendants = (pid: string) => {
        const children = files.filter((f) => f.parentId === pid);
        for (const child of children) {
          idsToDelete.push(child.id);
          if (child.isFolder) {
            findDescendants(child.id);
          }
        }
      };
      findDescendants(fileId);

      if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
        await deleteFromDisk(activeWorkspace.handle, target.path, target.isFolder);
      } else {
        for (const id of idsToDelete) {
          await deleteFileFromStorage(id);
        }
      }

      for (const id of idsToDelete) {
        closeTab(id);
      }
      setFiles((prev) => prev.filter((f) => !idsToDelete.includes(f.id)));
    },
    [files, activeWorkspace, closeTab]
  );

  const renameFile = useCallback(
    async (fileId: string, newName: string) => {
      const cleanName = newName.trim();
      const language = detectLanguage(cleanName);

      const target = files.find((f) => f.id === fileId);
      if (!target) return;

      const oldPath = target.path;
      let newPath = '/' + cleanName;
      if (target.parentId) {
        const parent = files.find((f) => f.id === target.parentId);
        if (parent) newPath = `${parent.path}/${cleanName}`;
      }

      if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
        await renameOnDisk(activeWorkspace.handle, oldPath, newPath, target.isFolder);
      }

      setFiles((prev) => {
        return prev.map((f) => {
          if (f.id === fileId) {
            const updated = { ...f, name: cleanName, path: newPath, language, updatedAt: Date.now() };
            if (activeWorkspace.type === 'sandbox') {
              saveFileToStorage(updated);
            }
            return updated;
          }
          if (f.path.startsWith(oldPath + '/')) {
            const childNewPath = newPath + f.path.slice(oldPath.length);
            const updatedChild = { ...f, path: childNewPath, updatedAt: Date.now() };
            if (activeWorkspace.type === 'sandbox') {
              saveFileToStorage(updatedChild);
            }
            return updatedChild;
          }
          return f;
        });
      });

      setTabs((prev) =>
        prev.map((t) => (t.fileId === fileId ? { ...t, title: cleanName, language } : t))
      );
    },
    [files, activeWorkspace]
  );

  const isSystemReady =
    compilerProgress.status === 'ready' &&
    vmStatus !== 'booting' &&
    vmStatus !== 'downloading' &&
    !isLinuxLoading;

  const systemStatus: SystemStatus =
    vmStatus === 'running'
      ? 'running'
      : compilerProgress.status === 'error' || vmStatus === 'error'
      ? 'error'
      : isSystemReady
      ? 'ready'
      : 'loading';

  const systemProgressPercent = compilerProgress.status === 'ready' ? 100 : compilerProgress.percent;

  const systemStatusMessage =
    systemStatus === 'ready'
      ? 'Sistema Pronto (Clang e Linux)'
      : systemStatus === 'running'
      ? 'Sistema Executando...'
      : systemStatus === 'error'
      ? compilerProgress.error || vmStatusMessage || 'Erro no Sistema'
      : compilerProgress.status === 'preloading'
      ? `Carregando Sistema (${compilerProgress.percent}%)...`
      : 'Inicializando Sistema...';

  function getFilesInProjectScope(filesList: FileItem[], activeItem: FileItem): FileItem[] {
    if (!activeItem.parentId) {
      return filesList.filter((f) => !f.isFolder && f.parentId === null);
    }

    const folderIds = new Set<string>([activeItem.parentId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of filesList) {
        if (f.isFolder && f.parentId && folderIds.has(f.parentId) && !folderIds.has(f.id)) {
          folderIds.add(f.id);
          added = true;
        }
      }
    }

    return filesList.filter((f) => !f.isFolder && f.parentId !== null && folderIds.has(f.parentId));
  }

  const runActiveFile = useCallback(
    (overrideContent?: string) => {
      setIsTerminalMinimized(false);
      window.dispatchEvent(new CustomEvent('theprog-clear-console'));
      vmManager.clearTerminal();
      window.dispatchEvent(new CustomEvent('theprog-focus-console'));

      if (!isSystemReady) {
        vmManager.emitOutput(
          `\r\n\x1b[33m[TheProg] Aguarde: O Sistema ainda está carregando (${systemProgressPercent}%)...\x1b[0m\r\n`
        );
        return;
      }

      if (!activeFile || activeFile.isFolder) {
        vmManager.emitOutput('\r\n\x1b[31mErro: Nenhum arquivo aberto para executar.\x1b[0m\r\n');
        return;
      }

      const codeToRun = overrideContent !== undefined ? overrideContent : (activeFile.content || '');

      // Salva imediatamente antes da execução (à prova de erros, independente de autoSave)
      if (saveTimeouts.current.has(activeFile.id)) {
        clearTimeout(saveTimeouts.current.get(activeFile.id));
        saveTimeouts.current.delete(activeFile.id);
      }
      const updated = { ...activeFile, content: codeToRun, updatedAt: Date.now() };
      if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
        saveFileToDisk(activeWorkspace.handle, activeFile.path, codeToRun).catch(console.error);
      } else {
        saveFileToStorage(updated);
      }
      vmManager.syncFile(activeFile.name, codeToRun);
      setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? updated : f)));
      setTabs((prev) => prev.map((t) => (t.fileId === activeFile.id ? { ...t, isDirty: false } : t)));

      const scopedFiles = getFilesInProjectScope(files, activeFile);
      const parentFolder = activeFile.parentId ? files.find((f) => f.id === activeFile.parentId) : null;
      const baseDirPath = parentFolder ? parentFolder.path : '';

      const folderFiles = new Map<string, string>();
      const encoder = new TextEncoder();
      const vfsFiles: { path: string; data: Uint8Array }[] = [];

      for (const f of scopedFiles) {
        const content = f.id === activeFile.id ? codeToRun : (f.content || '');
        const relPath = baseDirPath && f.path.startsWith(baseDirPath + '/')
          ? f.path.slice(baseDirPath.length + 1)
          : (f.path.startsWith('/') ? f.path.slice(1) : f.name);

        folderFiles.set(relPath, content);
        vfsFiles.push({
          path: relPath,
          data: encoder.encode(content),
        });
      }

      // Sincronização bidirecional do sistema de arquivos após execução WASI
      const handleFilesUpdated = (syncedFiles: { path: string; data: Uint8Array; isNew?: boolean }[]) => {
        const decoder = new TextDecoder('utf-8', { fatal: false });

        setFiles((prevFiles) => {
          const updatedFiles = [...prevFiles];
          const filesToPersist: FileItem[] = [];

          for (const synced of syncedFiles) {
            const decodedContent = decoder.decode(synced.data);
            const targetFullPath = baseDirPath ? `${baseDirPath}/${synced.path}` : `/${synced.path}`;

            const existingIndex = updatedFiles.findIndex((f) => !f.isFolder && f.path === targetFullPath);

            if (existingIndex !== -1) {
              const existingFile = updatedFiles[existingIndex];
              const modifiedFile: FileItem = {
                ...existingFile,
                content: decodedContent,
                updatedAt: Date.now(),
              };
              updatedFiles[existingIndex] = modifiedFile;
              filesToPersist.push(modifiedFile);
            } else {
              const parts = synced.path.split('/').filter(Boolean);
              let currentParentId: string | null = activeFile.parentId;
              let currentPathAcc = baseDirPath;

              for (let i = 0; i < parts.length - 1; i++) {
                const dirName = parts[i];
                const dirFullPath = currentPathAcc ? `${currentPathAcc}/${dirName}` : `/${dirName}`;
                let dirItem = updatedFiles.find((f) => f.isFolder && f.path === dirFullPath);
                if (!dirItem) {
                  const newDirId =
                    activeWorkspace.type === 'local'
                      ? 'local-' + dirFullPath.replace(/[^a-zA-Z0-9_-]/g, '_')
                      : 'f-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
                  recordInternalWrite(dirFullPath);
                  dirItem = {
                    id: newDirId,
                    name: dirName,
                    path: dirFullPath,
                    isFolder: true,
                    parentId: currentParentId,
                    language: 'plaintext',
                    updatedAt: Date.now(),
                  };
                  updatedFiles.push(dirItem);
                  filesToPersist.push(dirItem);
                }
                currentParentId = dirItem.id;
                currentPathAcc = dirFullPath;
              }

              const fileName = parts[parts.length - 1];
              const newFileId =
                activeWorkspace.type === 'local'
                  ? 'local-' + targetFullPath.replace(/[^a-zA-Z0-9_-]/g, '_')
                  : 'f-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
              recordInternalWrite(targetFullPath);
              const newFileItem: FileItem = {
                id: newFileId,
                name: fileName,
                path: targetFullPath,
                isFolder: false,
                parentId: currentParentId,
                language: detectLanguage(fileName),
                updatedAt: Date.now(),
                content: decodedContent,
              };

              updatedFiles.push(newFileItem);
              filesToPersist.push(newFileItem);
            }
          }

          setTimeout(() => {
            if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
              filesToPersist.forEach((f) => {
                saveFileToDisk(activeWorkspace.handle!, f.path, f.content || '').catch(console.error);
              });
            } else {
              filesToPersist.forEach((f) => saveFileToStorage(f));
            }
          }, 0);

          return updatedFiles;
        });
      };

      vmManager.runCode(activeFile.name, folderFiles, compilerFlags, vfsFiles, handleFilesUpdated);
    },
    [activeFile, files, isSystemReady, systemProgressPercent, compilerFlags, setIsTerminalMinimized, activeWorkspace]
  );

  const formatActiveFile = useCallback(async () => {
    if (!activeFile || activeFile.isFolder) return;
    const currentCode = activeFile.content || '';
    const formatted = await formatCode(currentCode, activeFile.name);
    if (formatted !== currentCode) {
      updateFileContent(activeFile.id, formatted);
    }
  }, [activeFile, updateFileContent]);

  const resetTerminal = useCallback(() => {
    vmManager.clearTerminal();
  }, []);

  const stopExecution = useCallback(() => {
    vmManager.stopExecution();
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setTabs((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) {
        return prev;
      }
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const moveFileItem = useCallback(
    async (fileId: string, newParentId: string | null) => {
      setFiles((prev) => {
        const target = prev.find((f) => f.id === fileId);
        if (!target || target.parentId === newParentId) return prev;

        if (newParentId) {
          let curr: FileItem | undefined = prev.find((f) => f.id === newParentId);
          while (curr) {
            if (curr.id === fileId) return prev;
            curr = curr.parentId ? prev.find((f) => f.id === curr!.parentId) : undefined;
          }
        }

        const newParent = newParentId ? prev.find((f) => f.id === newParentId) : null;
        const newBasePath = newParent ? newParent.path : '';
        const oldPath = target.path;
        const newPath = `${newBasePath}/${target.name}`;

        const updated = prev.map((f) => {
          if (f.id === fileId) {
            return { ...f, parentId: newParentId, path: newPath, updatedAt: Date.now() };
          }
          if (f.path.startsWith(oldPath + '/')) {
            return {
              ...f,
              path: newPath + f.path.slice(oldPath.length),
              updatedAt: Date.now(),
            };
          }
          return f;
        });

        setTimeout(() => {
          if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
            renameOnDisk(activeWorkspace.handle, oldPath, newPath, target.isFolder).catch(console.error);
          } else {
            updated.forEach((f) => {
              if (f.id === fileId || f.path.startsWith(newPath + '/')) {
                saveFileToStorage(f);
              }
            });
          }
        }, 0);

        return updated;
      });
    },
    [activeWorkspace]
  );

  useEffect(() => {
    if (tabs.length > 0) {
      const activeExists = tabs.some((t) => t.fileId === activeFileId);
      if (!activeExists) {
        setActiveFileId(tabs[tabs.length - 1].fileId);
      }
    } else {
      if (activeFileId !== null) {
        setActiveFileId(null);
      }
    }
  }, [tabs, activeFileId]);

  return (
    <EditorContext.Provider
      value={{
        files,
        activeFileId,
        activeFile,
        tabs,
        vmStatus,
        vmStatusMessage,
        compilerProgress,
        preloadCompiler,
        isSystemReady,
        systemStatus,
        systemProgressPercent,
        systemStatusMessage,
        isTerminalMinimized,
        setIsTerminalMinimized,
        isLinuxLoading,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
        sidebarWidth,
        setSidebarWidth: handleSetSidebarWidth,
        openFile,
        closeTab,
        updateFileContent,
        saveActiveFile,
        createNewFile,
        deleteFile,
        renameFile,
        downloadWorkspaceZip,
        runActiveFile,
        formatActiveFile,
        resetTerminal,
        stopExecution,
        reorderTabs,
        moveFileItem,
        fontSize,
        setFontSize: handleSetFontSize,
        increaseFontSize,
        decreaseFontSize,
        resetFontSize,
        terminalFontSize,
        setTerminalFontSize: handleSetTerminalFontSize,
        increaseTerminalFontSize,
        decreaseTerminalFontSize,
        resetTerminalFontSize,
        compilerFlags,
        setCompilerFlags,
        autoSave,
        setAutoSave,
        autoSaveDelay,
        setAutoSaveDelay,

        // Telas e Workspaces
        currentScreen,
        hasEnteredEditorSession,
        openWelcomeScreen,
        returnToEditor,
        activeWorkspace,
        recentWorkspaces,
        isWorkspacePickerOpen,
        openWorkspacePicker,
        closeWorkspacePicker,
        openLocalFolder,
        openSandboxWorkspace: loadSandboxWorkspace,
        selectRecentWorkspace,
        removeRecentWorkspaceItem,
        refreshCurrentWorkspace,
        alwaysOpenLast,
        setAlwaysOpenLast,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};
