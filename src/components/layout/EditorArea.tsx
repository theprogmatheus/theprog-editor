import React, { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { X, FileCode, Plus } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';

import { formatCode } from '../../utils/formatter';

export const EditorArea: React.FC = () => {
  const {
    tabs,
    activeFileId,
    activeFile,
    openFile,
    closeTab,
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

  const handleCreateFilePrompt = async () => {
    const filename = await showPrompt({
      title: 'Criar Novo Arquivo',
      message: 'Digite o nome do novo arquivo com a extensão:',
      placeholder: 'ex: main.c, script.py, index.html',
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
      // Atalhos de Zoom de Fonte (Ctrl + +, Ctrl + -, Ctrl + 0)
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

  // Se não houver abas abertas
  if (!activeFile) {
    return (
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
    );
  }

  const getMonacoLanguage = (lang: string): string => {
    switch (lang) {
      case 'c': return 'c';
      case 'cpp':
      case 'h': return 'cpp';
      case 'javascript': return 'javascript';
      case 'typescript': return 'typescript';
      case 'python': return 'python';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'shell': return 'shell';
      case 'rust': return 'rust';
      case 'go': return 'go';
      case 'java': return 'java';
      case 'sql': return 'sql';
      case 'markdown': return 'markdown';
      default: return 'plaintext';
    }
  };

  const monacoLanguage = getMonacoLanguage(activeFile.language);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#1e1e1e] transition-colors">
      {/* Barra de Abas */}
      <div className="h-9 flex items-center bg-[#ececec] dark:bg-[#181818] border-b border-[#e5e5e5] dark:border-[#202020] overflow-x-auto select-none no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.fileId === activeFileId;
          return (
            <div
              key={tab.fileId}
              onClick={() => openFile(tab.fileId)}
              className={`h-full flex items-center space-x-2 px-3 text-xs border-r border-[#e5e5e5] dark:border-[#202020] cursor-pointer transition-colors group relative shrink-0 ${
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
      </div>

      {/* Editor Monaco */}
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
    </div>
  );
};
