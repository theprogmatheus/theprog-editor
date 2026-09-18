import React, { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { X, FileCode, Plus } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';

import { formatCode } from '../../utils/formatter';

const getMonacoLanguage = (lang: string): string => {
  switch (lang) {
    case 'c': return 'c';
    case 'cpp':
    case 'h': return 'cpp';
    default: return 'plaintext';
  }
};

export const EditorArea: React.FC = () => {
  const {
    tabs,
    activeFileId,
    activeFile,
    openFile,
    closeTab,
    reorderTabs,
    updateFileContent,
    runActiveFile,
    formatActiveFile,
    createNewFile,
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
  } = useEditor();
  const { theme } = useTheme();
  const { showPrompt } = useDialog();
  const editorRef = useRef<any>(null);

  // Estados de Drag and Drop de Abas
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);

  // Menu de Contexto das Abas
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    fileId: string;
  } | null>(null);

  // Fecha o menu de contexto de aba
  useEffect(() => {
    const handleClose = () => setTabContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTabContextMenu(null);
    };
    if (tabContextMenu) {
      window.addEventListener('click', handleClose);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabContextMenu]);

  const handleCreateFilePrompt = async () => {
    const filename = await showPrompt({
      title: 'Criar Novo Arquivo',
      message: 'Digite o nome do novo arquivo com a extensão:',
      placeholder: 'ex: main.c, utils.c, helper.h',
      confirmText: 'Criar',
      cancelText: 'Cancelar',
    });
    if (filename && filename.trim()) {
      await createNewFile(filename.trim());
    }
  };

  const activeFileRef = useRef(activeFile);
  const runActiveFileRef = useRef(runActiveFile);
  const updateFileContentRef = useRef(updateFileContent);
  const formatActiveFileRef = useRef(formatActiveFile);
  const increaseFontSizeRef = useRef(increaseFontSize);
  const decreaseFontSizeRef = useRef(decreaseFontSize);
  const resetFontSizeRef = useRef(resetFontSize);

  useEffect(() => {
    activeFileRef.current = activeFile;
    runActiveFileRef.current = runActiveFile;
    updateFileContentRef.current = updateFileContent;
    formatActiveFileRef.current = formatActiveFile;
    increaseFontSizeRef.current = increaseFontSize;
    decreaseFontSizeRef.current = decreaseFontSize;
    resetFontSizeRef.current = resetFontSize;
  }, [activeFile, runActiveFile, updateFileContent, formatActiveFile, increaseFontSize, decreaseFontSize, resetFontSize]);

  const handleRun = () => {
    const currentCode = editorRef.current ? editorRef.current.getValue() : undefined;
    runActiveFileRef.current(currentCode);
  };

  // Dá foco imediato no editor quando o arquivo ativo muda ou é criado
  useEffect(() => {
    if (activeFileId && editorRef.current) {
      const timer = setTimeout(() => {
        editorRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeFileId]);

  const handleFormat = async () => {
    if (editorRef.current && activeFileRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model) {
        const fullRange = model.getFullModelRange();
        const currentCode = editor.getValue();
        const formatted = await formatCode(currentCode, activeFileRef.current.name);
        if (formatted !== currentCode) {
          editor.executeEdits('formatter', [
            {
              range: fullRange,
              text: formatted,
              forceMoveMarkers: true,
            },
          ]);
          updateFileContentRef.current(activeFileRef.current.id, formatted);
        }
      }
    } else {
      formatActiveFileRef.current();
    }
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.focus();

    // Atalho F5 para rodar
    editor.addCommand(monaco.KeyCode.F5, () => {
      handleRun();
    });

    // Atalho Shift+Alt+F para formatar código
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      handleFormat();
    });

    // Atalho Ctrl+S para salvar
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFileRef.current) {
        updateFileContentRef.current(activeFileRef.current.id, editor.getValue());
      }
    });

    // Atalhos para redimensionamento de fonte do editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, () => {
      increaseFontSizeRef.current();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, () => {
      decreaseFontSizeRef.current();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0, () => {
      resetFontSizeRef.current();
    });
  };

  // Captura atalhos F5, Shift+Alt+F, Ctrl+S e Ctrl++/Ctrl+- globalmente na janela
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleRun();
      }
      if (e.shiftKey && e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        handleFormat();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (activeFileRef.current && editorRef.current) {
          updateFileContentRef.current(activeFileRef.current.id, editorRef.current.getValue());
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        increaseFontSizeRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        decreaseFontSizeRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        resetFontSizeRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const monacoLanguage = activeFile ? getMonacoLanguage(activeFile.language) : 'plaintext';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#1e1e1e] transition-colors relative">
      {/* Barra de Abas - SEMPRE VISÍVEL NO DOM */}
      <div className="h-9 flex items-center bg-[#ececec] dark:bg-[#181818] border-b border-[#e5e5e5] dark:border-[#202020] overflow-x-auto select-none no-scrollbar">
        {tabs.map((tab, index) => {
          const isActive = tab.fileId === activeFileId;
          return (
            <div
              key={tab.fileId}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
                setDraggedTabIndex(index);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverTabIndex !== index) {
                  setDragOverTabIndex(index);
                }
              }}
              onDragLeave={() => {
                if (dragOverTabIndex === index) setDragOverTabIndex(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedTabIndex !== null && draggedTabIndex !== index) {
                  reorderTabs(draggedTabIndex, index);
                }
                setDraggedTabIndex(null);
                setDragOverTabIndex(null);
              }}
              onDragEnd={() => {
                setDraggedTabIndex(null);
                setDragOverTabIndex(null);
              }}
              onClick={() => openFile(tab.fileId)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTabContextMenu({ x: e.clientX, y: e.clientY, fileId: tab.fileId });
              }}
              className={`h-full flex items-center space-x-2 px-3 text-xs border-r border-[#e5e5e5] dark:border-[#202020] cursor-pointer transition-colors group relative shrink-0 ${
                draggedTabIndex === index ? 'opacity-40' : ''
              } ${
                dragOverTabIndex === index && draggedTabIndex !== index
                  ? 'border-l-2 border-l-[#007acc] bg-[#e8f0fe] dark:bg-[#094771]/30'
                  : ''
              } ${
                isActive
                  ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white font-medium border-t-2 border-t-[#007acc]'
                  : 'bg-[#ececec] dark:bg-[#181818] text-[#616161] dark:text-[#969696] hover:bg-[#f3f3f3] dark:hover:bg-[#252526] hover:text-black dark:hover:text-[#cccccc]'
              }`}
            >
              <span className="truncate max-w-[140px]">{tab.title}</span>

              {/* Indicador de modificado ou botão fechar */}
              <div className="w-4 h-4 flex items-center justify-center">
                {tab.isDirty ? (
                  <span className="w-2 h-2 rounded-full bg-[#007acc] dark:bg-white group-hover:hidden" />
                ) : null}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.fileId);
                  }}
                  title="Fechar aba"
                  className={`p-0.5 rounded-sm hover:bg-[#d8d8d8] dark:hover:bg-[#444444] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer ${
                    tab.isDirty ? 'hidden group-hover:block' : ''
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Botão sutil de Novo Arquivo na barra de abas */}
        <button
          onClick={handleCreateFilePrompt}
          title="Criar Novo Arquivo"
          className="h-full px-2.5 flex items-center justify-center text-[#777777] hover:text-black dark:hover:text-white hover:bg-[#f3f3f3] dark:hover:bg-[#252526] cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Menu de Contexto Customizado da Aba */}
      {tabContextMenu && (
        <div
          style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
          className="fixed z-50 min-w-[150px] py-1 bg-[#f3f3f3] dark:bg-[#252526] text-[#333333] dark:text-[#cccccc] rounded shadow-lg border border-[#cccccc] dark:border-[#454545] text-xs select-none"
        >
          <button
            onClick={() => {
              closeTab(tabContextMenu.fileId);
              setTabContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
          >
            <span>Fechar</span>
          </button>
          <button
            onClick={() => {
              tabs.forEach((t) => {
                if (t.fileId !== tabContextMenu.fileId) closeTab(t.fileId);
              });
              setTabContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
          >
            <span>Fechar Outras</span>
          </button>
          <button
            onClick={() => {
              tabs.forEach((t) => closeTab(t.fileId));
              setTabContextMenu(null);
            }}
            className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
          >
            <span>Fechar Todas</span>
          </button>
        </div>
      )}

      {/* Corpo Central: Monaco Editor OU Placeholder "Nenhum arquivo aberto" */}
      {activeFile ? (
        <div className="flex-1 w-full h-full relative">
          <Editor
            height="100%"
            language={monacoLanguage}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            value={activeFile.content || ''}
            onChange={(value) => {
              if (value !== undefined) {
                updateFileContent(activeFile.id, value);
              }
            }}
            onMount={handleEditorDidMount}
            options={{
              fontSize,
              fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
              fontLigatures: true,
              tabSize: 4,
              insertSpaces: true,
              automaticLayout: true,
              minimap: { enabled: true, side: 'right' },
              scrollBeyondLastLine: false,
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
              smoothScrolling: true,
              bracketPairColorization: { enabled: true },
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              fixedOverflowWidgets: true,
            }}
            loading={
              <div className="flex items-center justify-center h-full text-xs text-[#888888]">
                Carregando Editor...
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1e1e1e] text-[#616161] dark:text-[#858585] select-none p-6 transition-colors">
          <FileCode className="w-16 h-16 text-[#cccccc] dark:text-[#333333] mb-4 stroke-1" />
          <h2 className="text-base font-medium text-[#333333] dark:text-[#cccccc] mb-1">Nenhum arquivo aberto</h2>
          <p className="text-xs text-[#777777] mb-4">Selecione um arquivo no explorador à esquerda ou crie um novo</p>
          <button
            onClick={handleCreateFilePrompt}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#007acc] text-white text-xs hover:bg-[#0062a3] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Novo Arquivo</span>
          </button>
        </div>
      )}
    </div>
  );
};
