import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { FileItem, EditorTab, VMStatus, SupportedLanguage } from '../types/editor';
import { loadAllFiles, saveFileToStorage, deleteFileFromStorage } from '../services/storage';
import { vmManager } from '../services/vmManager';
import { formatCode } from '../utils/formatter';
import {
  preloadCompiler,
  subscribeCompilerProgress,
  getCompilerProgress,
  type CompilerProgress,
} from '../services/cCompiler';

export type SystemStatus = 'loading' | 'ready' | 'running' | 'error';

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
  setIsTerminalMinimized: (min: boolean) => void;
  isLinuxLoading: boolean;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
  openFile: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  createNewFile: (name: string, isFolder?: boolean, parentId?: string | null) => Promise<string>;
  deleteFile: (fileId: string) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
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
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [vmStatus, setVmStatus] = useState<VMStatus>('idle');
  const [vmStatusMessage, setVmStatusMessage] = useState<string>('Inicializando Linux...');
  const [compilerProgress, setCompilerProgress] = useState<CompilerProgress>(getCompilerProgress());
  const [isTerminalMinimized, setIsTerminalMinimized] = useState<boolean>(false);
  const [isLinuxLoading, setIsLinuxLoading] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
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

  const saveTimeouts = useRef<Map<string, any>>(new Map());

  // Salva a largura da sidebar
  const handleSetSidebarWidth = (w: number) => {
    const clamped = Math.max(180, Math.min(600, w));
    setSidebarWidth(clamped);
    localStorage.setItem('theprog_sidebar_width', clamped.toString());
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // Detecção focada em C e C++
  const detectLanguage = (filename: string): SupportedLanguage => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.c')) return 'c';
    if (lower.endsWith('.cpp') || lower.endsWith('.cc') || lower.endsWith('.cxx')) return 'cpp';
    if (lower.endsWith('.h') || lower.endsWith('.hpp')) return 'h';
    return 'plaintext';
  };

  // Carrega arquivos salvos na inicialização e simula boot do linux
  useEffect(() => {
    loadAllFiles().then((loadedFiles) => {
      setFiles(loadedFiles);
      loadedFiles.forEach((f) => {
        if (!f.isFolder && f.content) {
          vmManager.syncFile(f.name, f.content);
        }
      });

      const mainFile = loadedFiles.find((f) => f.name === 'main.c') || loadedFiles.find((f) => !f.isFolder);
      if (mainFile) {
        setActiveFileId(mainFile.id);
        setTabs([
          {
            fileId: mainFile.id,
            filePath: mainFile.path,
            title: mainFile.name,
            language: mainFile.language,
          },
        ]);
      }

      setTimeout(() => {
        setIsLinuxLoading(false);
      }, 1000);
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

    // Pré-carrega o compilador Clang WebAssembly em background
    const unsubscribeCompiler = subscribeCompilerProgress((prog) => {
      setCompilerProgress(prog);
    });

    preloadCompiler().catch((err) => {
      console.warn('Pré-carregamento em background falhou ou foi adiado:', err);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeCompiler();
    };
  }, []);

  const activeFile = files.find((f) => f.id === activeFileId) || null;

  const openFile = useCallback(
    (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file || file.isFolder) return;

      setActiveFileId(fileId);

      setTabs((prevTabs) => {
        const alreadyOpen = prevTabs.find((t) => t.fileId === fileId);
        if (alreadyOpen) return prevTabs;

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
        const nextTabs = prevTabs.filter((t) => t.fileId !== fileId);
        if (activeFileId === fileId) {
          if (nextTabs.length > 0) {
            setActiveFileId(nextTabs[nextTabs.length - 1].fileId);
          } else {
            setActiveFileId(null);
          }
        }
        return nextTabs;
      });
    },
    [activeFileId]
  );

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
    }

    const timer = setTimeout(async () => {
      setFiles((currentFiles) => {
        const fileToSave = currentFiles.find((f) => f.id === fileId);
        if (fileToSave) {
          saveFileToStorage(fileToSave);
          vmManager.syncFile(fileToSave.name, content);
        }
        return currentFiles;
      });

      setTabs((prev) =>
        prev.map((t) => (t.fileId === fileId ? { ...t, isDirty: false } : t))
      );
      saveTimeouts.current.delete(fileId);
    }, 400);

    saveTimeouts.current.set(fileId, timer);
  }, []);

  const createNewFile = useCallback(
    async (name: string, isFolder: boolean = false, parentId: string | null = null): Promise<string> => {
      const cleanName = name.trim();
      const id = 'f-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const language = detectLanguage(cleanName);

      let filePath = '/' + cleanName;
      if (parentId) {
        const parent = files.find((f) => f.id === parentId);
        if (parent) {
          filePath = `${parent.path}/${cleanName}`;
        }
      }

      const newFile: FileItem = {
        id,
        name: cleanName,
        path: filePath,
        isFolder,
        parentId,
        language,
        updatedAt: Date.now(),
        // Arquivos criados com nenhum conteúdo
        content: isFolder ? undefined : '',
      };

      await saveFileToStorage(newFile);
      setFiles((prev) => [...prev, newFile]);

      if (!isFolder) {
        vmManager.syncFile(newFile.name, newFile.content || '');
        setActiveFileId(newFile.id);
        setTabs((prevTabs) => {
          const alreadyOpen = prevTabs.find((t) => t.fileId === newFile.id);
          if (alreadyOpen) return prevTabs;
          return [
            ...prevTabs,
            {
              fileId: newFile.id,
              filePath: newFile.path,
              title: newFile.name,
              language: newFile.language,
            },
          ];
        });
      }

      return id;
    },
    [files]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      // Coleta todos os descendentes recursivamente se for uma pasta
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

      for (const id of idsToDelete) {
        await deleteFileFromStorage(id);
        closeTab(id);
      }
      setFiles((prev) => prev.filter((f) => !idsToDelete.includes(f.id)));
    },
    [files, closeTab]
  );

  const renameFile = useCallback(
    async (fileId: string, newName: string) => {
      const cleanName = newName.trim();
      const language = detectLanguage(cleanName);

      setFiles((prev) => {
        const target = prev.find((f) => f.id === fileId);
        if (!target) return prev;

        const oldPath = target.path;
        let newPath = '/' + cleanName;
        if (target.parentId) {
          const parent = prev.find((f) => f.id === target.parentId);
          if (parent) newPath = `${parent.path}/${cleanName}`;
        }

        const updatedFiles = prev.map((f) => {
          if (f.id === fileId) {
            const updated = { ...f, name: cleanName, path: newPath, language, updatedAt: Date.now() };
            saveFileToStorage(updated);
            return updated;
          }
          if (f.path.startsWith(oldPath + '/')) {
            const childNewPath = newPath + f.path.slice(oldPath.length);
            const updatedChild = { ...f, path: childNewPath, updatedAt: Date.now() };
            saveFileToStorage(updatedChild);
            return updatedChild;
          }
          return f;
        });

        return updatedFiles;
      });

      setTabs((prev) =>
        prev.map((t) => (t.fileId === fileId ? { ...t, title: cleanName, language } : t))
      );
    },
    []
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

  const runActiveFile = useCallback(
    (overrideContent?: string) => {
      // Garante que o terminal apareça se estiver minimizado
      setIsTerminalMinimized(false);

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

      // Salva imediatamente para que F5 e botão Executar nunca usem dados defasados por debounce
      if (overrideContent !== undefined && overrideContent !== activeFile.content) {
        if (saveTimeouts.current.has(activeFile.id)) {
          clearTimeout(saveTimeouts.current.get(activeFile.id));
          saveTimeouts.current.delete(activeFile.id);
        }
        const updated = { ...activeFile, content: overrideContent, updatedAt: Date.now() };
        saveFileToStorage(updated);
        setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? updated : f)));
        setTabs((prev) => prev.map((t) => (t.fileId === activeFile.id ? { ...t, isDirty: false } : t)));
      }

      vmManager.compileAndRun(activeFile.name, codeToRun);
    },
    [activeFile, isSystemReady, systemProgressPercent]
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

  // Reordenação de abas via Drag and Drop
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

  // Mover arquivo ou pasta na árvore do workspace
  const moveFileItem = useCallback(
    async (fileId: string, newParentId: string | null) => {
      setFiles((prev) => {
        const target = prev.find((f) => f.id === fileId);
        if (!target || target.parentId === newParentId) return prev;

        // Impede mover uma pasta para dentro de si mesma ou de seus descendentes
        if (newParentId) {
          let curr: FileItem | undefined = prev.find((f) => f.id === newParentId);
          while (curr) {
            if (curr.id === fileId) return prev; // Ciclo inválido!
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

        // Persiste assincronamente
        setTimeout(() => {
          updated.forEach((f) => {
            if (f.id === fileId || f.path.startsWith(newPath + '/')) {
              saveFileToStorage(f);
            }
          });
        }, 0);

        return updated;
      });
    },
    []
  );

  // Sincronização resiliente de abas: garante que se há abas, uma esteja ativa
  useEffect(() => {
    if (tabs.length > 0) {
      const activeExists = tabs.some((t) => t.fileId === activeFileId);
      if (!activeExists) {
        setActiveFileId(tabs[tabs.length - 1].fileId);
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
        createNewFile,
        deleteFile,
        renameFile,
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
