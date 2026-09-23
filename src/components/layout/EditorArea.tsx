import React, { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { X, FileCode, Plus, Columns2, Eye, Code } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';

import { formatCode } from '../../utils/formatter';
import { setWorkspaceFilesProvider } from '../../services/monaco/cLanguageService';
import { syncWorkspaceTsFiles } from '../../services/monaco/tsLanguageService';
import { getMonacoLanguage, isTextFileKind } from '../../services/languages/registry';
import { UnsupportedFileView } from '../common/UnsupportedFileView';
import { ImagePreview } from '../common/ImagePreview';
import { MarkdownPreview } from '../common/MarkdownPreview';

export const EditorArea: React.FC = () => {
  const {
    tabs,
    activeFileId,
    activeFile,
    files,
    openFile,
    pinTab,
    closeTab,
    reorderTabs,
    updateFileContent,
    saveActiveFile,
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

  // Sincroniza os arquivos do Workspace com o Language Service para resolução de #include "..."
  // e disponibiliza arquivos TS/JS para o IntelliSense entre arquivos (com debounce).
  useEffect(() => {
    setWorkspaceFilesProvider(() => files);
    const timer = setTimeout(() => {
      syncWorkspaceTsFiles(monaco, files);
    }, 800);
    return () => {
      clearTimeout(timer);
      setWorkspaceFilesProvider(null);
    };
  }, [files]);

  // Estados de Drag and Drop de Abas
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);

  // Estados de Split View e Markdown Preview
  const [isSplitView, setIsSplitView] = useState(false);
  const [secondaryFileId, setSecondaryFileId] = useState<string | null>(null);
  const [isMarkdownPreview, setIsMarkdownPreview] = useState(false);

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

    window.addEventListener('theprog-close-context-menu', handleClose);
    if (tabContextMenu) {
      window.addEventListener('click', handleClose);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('theprog-close-context-menu', handleClose);
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabContextMenu]);

  const handleCreateFilePrompt = async () => {
    const filename = await showPrompt({
      title: 'Criar Novo Arquivo',
      message: 'Digite o nome do novo arquivo com a extensão:',
      placeholder: 'ex: main.c, app.py, index.js, main.ts',
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
  const saveActiveFileRef = useRef(saveActiveFile);
  const formatActiveFileRef = useRef(formatActiveFile);
  const increaseFontSizeRef = useRef(increaseFontSize);
  const decreaseFontSizeRef = useRef(decreaseFontSize);
  const resetFontSizeRef = useRef(resetFontSize);

  useEffect(() => {
    activeFileRef.current = activeFile;
    runActiveFileRef.current = runActiveFile;
    updateFileContentRef.current = updateFileContent;
    saveActiveFileRef.current = saveActiveFile;
    formatActiveFileRef.current = formatActiveFile;
    increaseFontSizeRef.current = increaseFontSize;
    decreaseFontSizeRef.current = decreaseFontSize;
    resetFontSizeRef.current = resetFontSize;
  }, [activeFile, runActiveFile, updateFileContent, saveActiveFile, formatActiveFile, increaseFontSize, decreaseFontSize, resetFontSize]);

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

    // Ação de formatação integrada ao menu de contexto do editor (com atalho Shift+Alt+F)
    editor.addAction({
      id: 'format-document-action',
      label: 'Formatar Documento',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 1.5,
      run: () => {
        handleFormat();
      },
    });

    // Atalho F5 para rodar
    editor.addCommand(monaco.KeyCode.F5, () => {
      handleRun();
    });

    // Atalho explícito Ctrl+Space para disparar sugestões e autocompletion
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
    });

    // Atalho Ctrl+S para salvar
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveActiveFileRef.current();
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
        saveActiveFileRef.current();
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
  const secondaryFile = files.find((f) => f.id === secondaryFileId) || null;

  const [forcedText, setForcedText] = useState<{ fileId: string; content: string } | null>(null);

  useEffect(() => {
    setForcedText(null);
  }, [activeFileId]);

  const handleForceText = async () => {
    if (!activeFile) return;
    try {
      const handle = activeFile.handle as FileSystemFileHandle | undefined;
      if (!handle || typeof handle.getFile !== 'function') return;
      const diskFile = await handle.getFile();
      const content = await diskFile.text();
      setForcedText({ fileId: activeFile.id, content });
    } catch (err) {
      console.warn('Não foi possível abrir o arquivo como texto:', err);
    }
  };

  const isForcedTextView = Boolean(forcedText && forcedText.fileId === activeFile?.id);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-[#1e1e1e] transition-colors relative">
      {/* Barra de Abas - SEMPRE VISÍVEL NO DOM */}
      <div className="h-9 min-h-9 shrink-0 flex items-center bg-[#ececec] dark:bg-[#181818] border-b border-[#e5e5e5] dark:border-[#202020] overflow-x-auto select-none no-scrollbar touch-pan-x">
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
              onDoubleClick={() => pinTab(tab.fileId)}
              data-tab-item="true"
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent('theprog-close-context-menu'));
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
              <span
                className={`truncate max-w-[140px] ${
                  tab.isPreview ? 'italic font-normal text-neutral-500 dark:text-neutral-400' : ''
                }`}
              >
                {tab.title}
              </span>

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

        {/* Ações da Barra de Abas (Markdown Preview & Split View) */}
        <div className="ml-auto flex items-center h-full px-2 space-x-1 shrink-0">
          {activeFile?.language === 'markdown' && (
            <button
              onClick={() => setIsMarkdownPreview(!isMarkdownPreview)}
              title={isMarkdownPreview ? 'Voltar para Edição' : 'Pré-visualizar Markdown'}
              className={`p-1.5 rounded cursor-pointer transition-colors ${
                isMarkdownPreview
                  ? 'bg-[#007acc] text-white'
                  : 'text-[#777777] hover:text-black dark:hover:text-white hover:bg-[#e0e0e0] dark:hover:bg-[#252526]'
              }`}
            >
              {isMarkdownPreview ? <Code className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={() => {
              if (!isSplitView) {
                const other = tabs.find((t) => t.fileId !== activeFileId);
                if (other) setSecondaryFileId(other.fileId);
              }
              setIsSplitView(!isSplitView);
            }}
            title={isSplitView ? 'Fechar Divisão de Tela' : 'Dividir Editor Lado a Lado (Split View)'}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              isSplitView
                ? 'bg-[#007acc] text-white'
                : 'text-[#777777] hover:text-black dark:hover:text-white hover:bg-[#e0e0e0] dark:hover:bg-[#252526]'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Menu de Contexto Customizado da Aba */}
      {tabContextMenu && (
        <div
          style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
          className="fixed z-50 min-w-[150px] py-1 bg-[#f3f3f3] dark:bg-[#252526] text-[#333333] dark:text-[#cccccc] rounded shadow-lg border border-[#cccccc] dark:border-[#454545] text-xs select-none"
        >
          {tabs.find((t) => t.fileId === tabContextMenu.fileId)?.isPreview && (
            <button
              onClick={() => {
                pinTab(tabContextMenu.fileId);
                setTabContextMenu(null);
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left font-medium"
            >
              <span>Fixar Aba</span>
            </button>
          )}
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

      {/* Corpo Central: Visualização Dividida OU Tela Cheia */}
      <div className="flex-1 w-full h-full min-h-0 flex overflow-hidden">
        {/* Painel Primário */}
        <div
          className={`h-full min-h-0 min-w-0 flex flex-col ${
            isSplitView ? 'flex-1 border-r border-[#e5e5e5] dark:border-[#252526]' : 'w-full'
          }`}
        >
          {activeFile ? (
            activeFile.language === 'markdown' && isMarkdownPreview ? (
              <MarkdownPreview content={activeFile.content || ''} filename={activeFile.name} />
            ) : isTextFileKind(activeFile.kind) || isForcedTextView ? (
              <div className="flex-1 w-full h-full min-h-0 relative">
                <Editor
                  height="100%"
                  path={activeFile.path || activeFile.name}
                  language={monacoLanguage}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  value={isForcedTextView ? forcedText!.content : activeFile.content || ''}
                  onChange={(value) => {
                    if (value !== undefined && !isForcedTextView) {
                      updateFileContent(activeFile.id, value);
                    }
                  }}
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: isForcedTextView,
                    fontSize,
                    fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
                    fontLigatures: true,
                    tabSize: 4,
                    insertSpaces: true,
                    automaticLayout: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    renderLineHighlight: 'all',
                    cursorBlinking: 'smooth',
                    smoothScrolling: true,
                    bracketPairColorization: { enabled: true },
                    lineNumbers: 'on',
                    renderWhitespace: 'selection',
                    fixedOverflowWidgets: true,
                    quickSuggestions: { other: true, comments: false, strings: false },
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    tabCompletion: 'on',
                    suggestSelection: 'first',
                    wordBasedSuggestions: 'matchingDocuments',
                    parameterHints: { enabled: true, cycle: true },
                    suggest: {
                      snippetsPreventQuickSuggestions: false,
                      showWords: true,
                      showVariables: true,
                      showFunctions: true,
                      showConstants: true,
                      showStructs: true,
                      showKeywords: true,
                      showSnippets: true,
                      showModules: true,
                      showFields: true,
                    },
                  }}
                  loading={
                    <div className="flex items-center justify-center h-full text-xs text-[#888888]">
                      Carregando Editor...
                    </div>
                  }
                />
              </div>
            ) : activeFile.kind === 'image' ? (
              <ImagePreview file={activeFile} />
            ) : (
              <UnsupportedFileView file={activeFile} onForceText={handleForceText} />
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1e1e1e] text-[#616161] dark:text-[#858585] select-none p-6 transition-colors text-center h-full">
              <FileCode className="w-16 h-16 text-[#cccccc] dark:text-[#333333] mb-4 stroke-1" />
              <h2 className="text-base font-medium text-[#333333] dark:text-[#cccccc] mb-1">
                Nenhum arquivo aberto
              </h2>
              <p className="text-xs text-[#777777] max-w-xs">
                Selecione um arquivo no explorador lateral para começar a programar
              </p>
            </div>
          )}
        </div>

        {/* Painel Secundário (Split View) */}
        {isSplitView && (
          <div className="flex-1 h-full min-h-0 min-w-0 flex flex-col bg-white dark:bg-[#1e1e1e]">
            {/* Cabeçalho do painel secundário */}
            <div className="h-8 px-3 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#202020] bg-[#f9f9f9] dark:bg-[#1c1c1c] text-xs shrink-0 select-none">
              <span className="font-semibold text-black dark:text-white">Editor Secundário</span>
              <select
                value={secondaryFileId || ''}
                onChange={(e) => setSecondaryFileId(e.target.value)}
                className="px-2 py-0.5 text-xs rounded bg-white dark:bg-[#252526] border border-[#cccccc] dark:border-[#404040] text-black dark:text-white"
              >
                {files
                  .filter((f) => !f.isFolder)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
              {secondaryFile && (isTextFileKind(secondaryFile.kind) || secondaryFile.content !== undefined) ? (
                <Editor
                  height="100%"
                  path={`secondary_${secondaryFile.path || secondaryFile.name}`}
                  language={getMonacoLanguage(secondaryFile.language)}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  value={secondaryFile.content || ''}
                  onChange={(val) => {
                    if (val !== undefined) updateFileContent(secondaryFile.id, val);
                  }}
                  options={{
                    fontSize,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    lineNumbers: 'on',
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-[#888888]">
                  Selecione um arquivo secundário acima para editar em paralelo.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
