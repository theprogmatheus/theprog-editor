import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import type {
  FileItem,
  EditorTab,
  VMStatus,
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
  readFileFromDisk,
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
import { runtimeManager } from '../services/runtimes/manager';
import { pythonRuntime } from '../services/runtimes/pythonRuntime';
import type { RuntimeProgressMap } from '../services/runtimes/types';
import type { RunPlan } from '../services/languages/types';
import { getRunCapability } from '../services/languages/runCapability';
import {
  detectLanguage,
  detectFileKindByExtension,
  detectFileKindFromBytes,
  getRuntimeForLanguage,
  isLikelyBinaryByName,
  isTextFileKind,
} from '../services/languages/registry';
import { loadPythonWheels, savePythonWheel } from '../services/pythonPackages';
import { splitPathSegments, isPathValidForCreation } from '../services/fileTree/pathUtils';

export type SystemStatus = 'loading' | 'ready' | 'running' | 'error';
export type AppScreen = 'welcome' | 'editor';

function isInvalidFileName(name: string): boolean {
  return !isPathValidForCreation(name);
}

interface EditorContextType {
  files: FileItem[];
  activeFileId: string | null;
  activeFile: FileItem | null;
  tabs: EditorTab[];
  vmStatus: VMStatus;
  vmStatusMessage: string;
  runtimes: RuntimeProgressMap;
  preloadRuntimes: () => Promise<void>;
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
  openFile: (fileId: string, options?: { preview?: boolean }) => void;
  pinTab: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  createNewFile: (
    name: string,
    isFolder?: boolean,
    parentId?: string | null,
    initialContent?: string
  ) => Promise<string>;
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
  compactFolders: boolean;
  setCompactFolders: (enabled: boolean) => void;
  previewMode: boolean;
  setPreviewMode: (enabled: boolean) => void;
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
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [vmStatus, setVmStatus] = useState<VMStatus>('idle');
  const [vmStatusMessage, setVmStatusMessage] = useState<string>('Inicializando ambientes...');
  const [runtimes, setRuntimes] = useState<RuntimeProgressMap>(runtimeManager.getProgress());
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

  const [compactFolders, setCompactFoldersState] = useState<boolean>(() => {
    const saved = localStorage.getItem('theprog_compact_folders');
    return saved !== null ? saved === 'true' : true;
  });

  const setCompactFolders = useCallback((enabled: boolean) => {
    setCompactFoldersState(enabled);
    localStorage.setItem('theprog_compact_folders', String(enabled));
  }, []);

  const [previewMode, setPreviewModeState] = useState<boolean>(() => {
    const saved = localStorage.getItem('theprog_preview_mode');
    return saved !== null ? saved === 'true' : true;
  });

  const setPreviewMode = useCallback((enabled: boolean) => {
    setPreviewModeState(enabled);
    localStorage.setItem('theprog_preview_mode', String(enabled));
  }, []);

  const saveTimeouts = useRef<Map<string, any>>(new Map());
  const currentWsKeyRef = useRef<string>('');
  const activeWorkspaceKeyRef = useRef<string>('sandbox');

  const handleSetSidebarWidth = (w: number) => {
    const clamped = Math.max(180, Math.min(600, w));
    setSidebarWidth(clamped);
    localStorage.setItem('theprog_sidebar_width', clamped.toString());
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
      for (const f of files) {
        if (!f.isFolder) {
          const cleanPath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
          if (f.content !== undefined) {
            zip.file(cleanPath, f.content);
          } else if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
            const raw = await readFileFromDisk(activeWorkspace.handle, f.path);
            if (raw) {
              zip.file(cleanPath, raw);
            }
          }
        }
      }
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
  }, [files, activeWorkspace]);

  // Inicialização da aplicação: gerencia workspaces recentes e decisão de tela inicial
  useEffect(() => {
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

    const unsubscribeRuntimes = runtimeManager.subscribe((progress) => {
      setRuntimes(progress);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeRuntimes();
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
        if (!snapshot) {
          return;
        }

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
              const extKind = detectFileKindByExtension(name);
              const fileKind = meta.isFolder
                ? undefined
                : meta.size > 5 * 1024 * 1024
                ? 'too_large'
                : extKind ?? undefined;

              const newItem: FileItem = {
                id: 'local-' + snapPath.replace(/[^a-zA-Z0-9_-]/g, '_'),
                name,
                path: snapPath,
                isFolder: meta.isFolder,
                parentId: parent ? parent.id : null,
                language: detectLanguage(name),
                updatedAt: meta.lastModified || Date.now(),
                kind: fileKind,
                size: meta.size,
                content: meta.isFolder ? undefined : '',
              };
              updated.push(newItem);

              if (!meta.isFolder && meta.size <= 5 * 1024 * 1024 && !isLikelyBinaryByName(name)) {
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

          // 2. Detectar arquivos ou pastas removidas pelo SO (preserva arquivos com alterações não salvas)
          const snapshotPaths = new Set(snapshot.keys());
          const finalFiles: FileItem[] = [];
          for (const f of updated) {
            const isDirty = tabs.some((t) => (t.fileId === f.id || t.filePath === f.path) && t.isDirty);
            if (snapshotPaths.has(f.path) || isRecentInternalWrite(f.path) || isDirty) {
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

            if (snap.lastModified > f.updatedAt && !isRecentInternalWrite(f.path) && !isLikelyBinaryByName(f.name)) {
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

  // Carregamento modular sob demanda (lazy loading) quando o usuário abre/foca um arquivo
  useEffect(() => {
    if (!activeFile || activeFile.isFolder) return;
    if (activeFile.language === 'c' || activeFile.language === 'cpp') {
      runtimeManager.preload('clang').catch((err) => {
        console.warn('Pré-carregamento Clang sob demanda adiado:', err);
      });
    } else if (activeFile.language === 'python') {
      runtimeManager.preload('python').catch((err) => {
        console.warn('Pré-carregamento Python sob demanda adiado:', err);
      });
    } else if (activeFile.language === 'javascript' || activeFile.language === 'typescript') {
      runtimeManager.preload('js').catch((err) => {
        console.warn('Pré-carregamento JS/TS sob demanda adiado:', err);
      });
    }
  }, [activeFile]);

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
    (fileId: string, options?: { preview?: boolean }) => {
      const file = files.find((f) => f.id === fileId);
      if (!file || file.isFolder) return;

      setActiveFileId(file.id);

      const isPreview = options?.preview ?? previewMode;

      setTabs((prevTabs) => {
        const alreadyOpen = prevTabs.find((t) => t.fileId === file.id || t.filePath === file.path);
        if (alreadyOpen) {
          return prevTabs.map((t) => {
            if (t.fileId === file.id || t.filePath === file.path) {
              return {
                ...t,
                fileId: file.id,
                filePath: file.path,
                title: file.name,
                language: file.language,
                isPreview: options?.preview === false ? false : t.isPreview,
              };
            }
            return t;
          });
        }

        // Se for para abrir em modo preview, substitui a aba preview existente se não tiver modificações
        if (isPreview) {
          const previewIdx = prevTabs.findIndex((t) => t.isPreview && !t.isDirty);
          if (previewIdx !== -1) {
            const nextTabs = [...prevTabs];
            nextTabs[previewIdx] = {
              fileId: file.id,
              filePath: file.path,
              title: file.name,
              language: file.language,
              isPreview: true,
            };
            return nextTabs;
          }
        }

        return [
          ...prevTabs,
          {
            fileId: file.id,
            filePath: file.path,
            title: file.name,
            language: file.language,
            isPreview,
          },
        ];
      });
    },
    [files, previewMode]
  );

  const pinTab = useCallback((fileId: string) => {
    setTabs((prevTabs) =>
      prevTabs.map((t) => (t.fileId === fileId ? { ...t, isPreview: false } : t))
    );
  }, []);

  const closeTab = useCallback(
    (fileId: string) => {
      const targetTab = tabs.find((t) => t.fileId === fileId);
      if (targetTab?.isDirty) {
        const confirmed = window.confirm(
          `O arquivo "${targetTab.title}" possui alterações não salvas. Deseja fechar sem salvar?`
        );
        if (!confirmed) return;
      }
      setTabs((prevTabs) => {
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
    [tabs, activeFileId, activeFile]
  );

  useEffect(() => {
    const hasDirtyTabs = tabs.some((t) => t.isDirty);
    if (!hasDirtyTabs) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tabs]);

  const saveActiveFile = useCallback(async () => {
    if (!activeFile || activeFile.isFolder) return;
    if (!isTextFileKind(activeFile.kind)) return;
    const fileId = activeFile.id;

    if (saveTimeouts.current.has(fileId)) {
      clearTimeout(saveTimeouts.current.get(fileId));
      saveTimeouts.current.delete(fileId);
    }

    const contentToSave = activeFile.content || '';
    let saveOk = false;
    try {
      if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
        await saveFileToDisk(activeWorkspace.handle, activeFile.path, contentToSave);
      } else {
        await saveFileToStorage(activeFile);
      }
      saveOk = true;
    } catch (err) {
      console.error('Erro ao salvar no disco:', err);
    }

    if (saveOk) {
      vmManager.syncFile(activeFile.name, contentToSave);
      setTabs((prev) =>
        prev.map((t) => (t.fileId === fileId ? { ...t, isDirty: false } : t))
      );
    }
  }, [activeFile, activeWorkspace]);

  const updateFileContent = useCallback((fileId: string, content: string) => {
    const target = filesRef.current.find((f) => f.id === fileId);
    if (!isTextFileKind(target?.kind)) return;

    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileId) {
          return { ...f, content, updatedAt: Date.now() };
        }
        return f;
      })
    );

    setTabs((prev) =>
      prev.map((t) => (t.fileId === fileId ? { ...t, isDirty: true, isPreview: false } : t))
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
      saveTimeouts.current.delete(fileId);
      const fileToSave = filesRef.current.find((f) => f.id === fileId);
      if (!fileToSave) return;

      let saveOk = false;
      try {
        if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
          await saveFileToDisk(activeWorkspace.handle, fileToSave.path, content);
        } else {
          await saveFileToStorage({ ...fileToSave, content, updatedAt: Date.now() });
        }
        saveOk = true;
      } catch (err) {
        console.error('Erro no salvamento automático:', err);
      }

      if (saveOk) {
        vmManager.syncFile(fileToSave.name, content);
        setTabs((prev) =>
          prev.map((t) => (t.fileId === fileId ? { ...t, isDirty: false } : t))
        );
      }
    }, autoSaveDelay);

    saveTimeouts.current.set(fileId, timer);
  }, [activeWorkspace, autoSave, autoSaveDelay]);

  const createNewFile = useCallback(
    async (
      name: string,
      isFolder: boolean = false,
      parentId: string | null = null,
      initialContent: string = ''
    ): Promise<string> => {
      const cleanInput = name.trim();
      if (!isPathValidForCreation(cleanInput)) {
        throw new Error(
          'Nome de arquivo inválido. Evite caracteres especiais (/ \\ : * ? " < > |) e caminhos relativos.'
        );
      }

      const segments = splitPathSegments(cleanInput);
      if (segments.length === 0) {
        throw new Error('Nome de arquivo inválido.');
      }

      let currentParentId = parentId;
      let currentParentPath = '';
      if (currentParentId) {
        const parent = filesRef.current.find((f) => f.id === currentParentId);
        if (parent) currentParentPath = parent.path;
      }

      const createdItems: FileItem[] = [];
      let finalItemId = '';

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const isLeaf = i === segments.length - 1;
        const itemIsFolder = isLeaf ? isFolder : true;
        const itemPath = currentParentPath ? `${currentParentPath}/${seg}` : `/${seg}`;

        // Procura se já existe no estado atual ou nos itens recém-criados
        const existing =
          filesRef.current.find((f) => f.path === itemPath) ||
          createdItems.find((f) => f.path === itemPath);

        if (existing) {
          currentParentId = existing.id;
          currentParentPath = existing.path;
          if (isLeaf) {
            finalItemId = existing.id;
          }
          continue;
        }

        const id =
          activeWorkspace.type === 'local'
            ? 'local-' + itemPath.replace(/[^a-zA-Z0-9_-]/g, '_')
            : 'f-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

        const language = itemIsFolder ? 'plaintext' : detectLanguage(seg);
        const content = itemIsFolder ? undefined : isLeaf ? initialContent : '';

        const newItem: FileItem = {
          id,
          name: seg,
          path: itemPath,
          isFolder: itemIsFolder,
          parentId: currentParentId,
          language,
          updatedAt: Date.now(),
          content,
        };

        recordInternalWrite(itemPath);

        if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
          if (itemIsFolder) {
            await createFolderOnDisk(activeWorkspace.handle, itemPath);
          } else {
            await createFileOnDisk(activeWorkspace.handle, itemPath);
            if (content) {
              await saveFileToDisk(activeWorkspace.handle, itemPath, content);
            }
          }
        } else {
          await saveFileToStorage(newItem);
        }

        recordInternalWrite(itemPath);

        createdItems.push(newItem);
        currentParentId = id;
        currentParentPath = itemPath;
        if (isLeaf) {
          finalItemId = id;
        }
      }

      if (createdItems.length > 0) {
        setFiles((prev) => {
          const map = new Map(prev.map((f) => [f.path, f]));
          for (const item of createdItems) {
            map.set(item.path, item);
          }
          return Array.from(map.values());
        });
      }

      const leafItem =
        createdItems.find((f) => f.id === finalItemId) ||
        filesRef.current.find((f) => f.id === finalItemId);

      if (leafItem && !leafItem.isFolder) {
        vmManager.syncFile(leafItem.name, leafItem.content || '');
        setActiveFileId(leafItem.id);
        openFile(leafItem.id, { preview: false });
      }

      return finalItemId;
    },
    [activeWorkspace, openFile]
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
      if (isInvalidFileName(cleanName)) {
        throw new Error('Nome de arquivo inválido. Evite caracteres especiais (/ \\ : * ? " < > |) e caminhos relativos.');
      }
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
        prev.map((t) => {
          if (t.fileId === fileId) {
            return { ...t, title: cleanName, language, filePath: newPath };
          }
          if (t.filePath.startsWith(oldPath + '/')) {
            return { ...t, filePath: newPath + t.filePath.slice(oldPath.length) };
          }
          return t;
        })
      );
    },
    [files, activeWorkspace]
  );

  const runtimeAggregate = runtimeManager.getAggregate();
  const clangProgress = runtimes.clang;

  const isSystemReady =
    clangProgress?.status === 'ready' &&
    vmStatus !== 'booting' &&
    vmStatus !== 'downloading' &&
    !isLinuxLoading;

  const systemStatus: SystemStatus =
    vmStatus === 'running'
      ? 'running'
      : clangProgress?.status === 'error' || vmStatus === 'error'
      ? 'error'
      : isSystemReady
      ? 'ready'
      : 'loading';

  const systemProgressPercent = runtimeAggregate.percent;

  const systemStatusMessage =
    systemStatus === 'ready'
      ? 'Sistema pronto'
      : systemStatus === 'running'
      ? 'Sistema executando...'
      : systemStatus === 'error'
      ? clangProgress?.error || vmStatusMessage || 'Erro no sistema'
      : runtimeAggregate.isLoading
      ? `Preparando ambientes (${runtimeAggregate.percent}%)...`
      : 'Inicializando ambientes...';

  function getFilesInProjectScope(filesList: FileItem[], _activeItem: FileItem): FileItem[] {
    return filesList.filter((f) => !f.isFolder);
  }

  const runActiveFile = useCallback(
    (overrideContent?: string) => {
      setIsTerminalMinimized(false);
      window.dispatchEvent(new CustomEvent('theprog-clear-console'));
      vmManager.clearTerminal();
      window.dispatchEvent(new CustomEvent('theprog-focus-console'));

      if (!activeFile || activeFile.isFolder) {
        vmManager.setActiveTab('environment');
        vmManager.emitEnvironmentOutput(
          '\r\n\x1b[31m[Erro: Nenhum arquivo aberto para executar]\x1b[0m\r\n'
        );
        return;
      }

      const codeToRun = overrideContent !== undefined ? overrideContent : (activeFile.content || '');

      const capability = getRunCapability({ ...activeFile, content: codeToRun }, runtimes);
      if (!capability.canRun) {
        vmManager.setActiveTab('environment');
        vmManager.emitEnvironmentOutput(
          `\r\n\x1b[33m[${capability.reason || 'Execução indisponível para este arquivo'}]\x1b[0m\r\n`
        );
        return;
      }

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
      const folderFiles = new Map<string, string>();
      let entryRelPath = activeFile.name;

      for (const f of scopedFiles) {
        const content = f.id === activeFile.id ? codeToRun : (f.content || '');
        const relPath = f.path.startsWith('/') ? f.path.slice(1) : f.path;

        if (f.id === activeFile.id) {
          entryRelPath = relPath;
        }
        folderFiles.set(relPath, content);
      }

      if (!folderFiles.has(entryRelPath)) {
        folderFiles.set(entryRelPath, codeToRun);
      }

      // Chave do workspace desta execução: se o usuário trocar de projeto durante a
      // execução, os arquivos sincronizados não devem contaminar o novo workspace.
      const runWorkspaceKey =
        activeWorkspace.type === 'local' ? `local_${activeWorkspace.name}` : 'sandbox';

      // Sincronização bidirecional do sistema de arquivos após execução
      const handleFilesUpdated = (syncedFiles: { path: string; data: Uint8Array; isNew?: boolean }[]) => {
        if (activeWorkspaceKeyRef.current !== runWorkspaceKey) {
          return;
        }

        const decoder = new TextDecoder('utf-8', { fatal: false });

        setFiles((prevFiles) => {
          const updatedFiles = [...prevFiles];
          const filesToPersist: { item: FileItem; rawData: Uint8Array | string }[] = [];

          for (const synced of syncedFiles) {
            const kind = detectFileKindByExtension(synced.path) ?? detectFileKindFromBytes(synced.data);
            const isText = isTextFileKind(kind);
            const decodedContent = isText ? decoder.decode(synced.data) : undefined;
            const targetFullPath = synced.path.startsWith('/') ? synced.path : `/${synced.path}`;

            const existingIndex = updatedFiles.findIndex((f) => !f.isFolder && f.path === targetFullPath);

            if (existingIndex !== -1) {
              const existingFile = updatedFiles[existingIndex];
              const modifiedFile: FileItem = {
                ...existingFile,
                content: decodedContent,
                kind,
                size: synced.data.byteLength,
                updatedAt: Date.now(),
              };
              updatedFiles[existingIndex] = modifiedFile;
              filesToPersist.push({
                item: modifiedFile,
                rawData: isText ? (decodedContent || '') : synced.data,
              });
            } else {
              const parts = synced.path.split('/').filter(Boolean);
              let currentParentId: string | null = null;
              let currentPathAcc = '';

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
                kind,
                size: synced.data.byteLength,
                updatedAt: Date.now(),
                content: decodedContent,
              };

              updatedFiles.push(newFileItem);
              filesToPersist.push({
                item: newFileItem,
                rawData: isText ? (decodedContent || '') : synced.data,
              });
            }
          }

          setTimeout(() => {
            if (activeWorkspace.type === 'local' && activeWorkspace.handle) {
              filesToPersist.forEach(({ item, rawData }) => {
                saveFileToDisk(activeWorkspace.handle!, item.path, rawData).catch(console.error);
              });
            } else {
              filesToPersist.forEach(({ item }) => saveFileToStorage(item));
            }
          }, 0);

          return updatedFiles;
        });
      };

      const runtime = getRuntimeForLanguage(activeFile.language);
      if (!runtime) {
        vmManager.setActiveTab('environment');
        vmManager.emitEnvironmentOutput(
          `\r\n\x1b[33m[Linguagem '${activeFile.language}' não suportada para execução]\x1b[0m\r\n`
        );
        return;
      }

      const statusMessage =
        runtime === 'clang'
          ? `Compilando ${activeFile.name}...`
          : runtime === 'python'
          ? `Interpretando ${activeFile.name}...`
          : `Executando ${activeFile.name}...`;

      const plan: RunPlan = {
        runtime,
        language: activeFile.language,
        entryFile: entryRelPath,
        files: folderFiles,
        args: runtime === 'clang' ? compilerFlags : [],
        statusMessage,
      };

      vmManager.run(plan, { onFilesUpdated: handleFilesUpdated });
    },
    [activeFile, files, runtimes, compilerFlags, setIsTerminalMinimized, activeWorkspace]
  );

  const formatActiveFile = useCallback(async () => {
    if (!activeFile || activeFile.isFolder) return;
    if (!isTextFileKind(activeFile.kind)) return;
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

  // Mantém a chave do workspace ativo acessível a callbacks assíncronos de execução
  useEffect(() => {
    activeWorkspaceKeyRef.current =
      activeWorkspace.type === 'local' ? `local_${activeWorkspace.name}` : 'sandbox';
  }, [activeWorkspace]);

  // Persistência offline de pacotes Python (wheels) no workspace ativo
  useEffect(() => {
    pythonRuntime.setWheelSink((wheel) => {
      const version = pythonRuntime.getPyodideVersion();
      if (version) {
        savePythonWheel(activeWorkspace, wheel, version);
      }
    });
    return () => pythonRuntime.setWheelSink(null);
  }, [activeWorkspace]);

  // Restaura pacotes Python cacheados assim que o runtime fica pronto
  const isPythonReady = runtimes.python?.status === 'ready';
  useEffect(() => {
    if (!isPythonReady || !isStorageLoaded) return;
    let cancelled = false;
    (async () => {
      const version = pythonRuntime.getPyodideVersion();
      if (!version) return;
      const wheels = await loadPythonWheels(activeWorkspace, version);
      if (!cancelled && wheels.length > 0) {
        pythonRuntime.restoreWheels(wheels);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPythonReady, activeWorkspace, isStorageLoaded]);

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
        runtimes,
        preloadRuntimes: () => runtimeManager.preloadAll(),
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
        pinTab,
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
        compactFolders,
        setCompactFolders,
        previewMode,
        setPreviewMode,

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
