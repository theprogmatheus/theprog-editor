import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import {
  Terminal as TerminalIcon,
  Hammer,
  Trash2,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  Copy,
  ClipboardPaste,
  CheckSquare,
  Layers,
} from 'lucide-react';
import { vmManager, type ConsoleTab } from '../../services/vmManager';
import { useTheme } from '../../context/ThemeContext';
import { useEditor } from '../../context/EditorContext';
import { TestRunnerPanel } from './TestRunnerPanel';

export const TerminalPanel: React.FC = () => {
  const environmentRef = useRef<HTMLDivElement>(null);
  const executionRef = useRef<HTMLDivElement>(null);

  const environmentXterm = useRef<XTerm | null>(null);
  const executionXterm = useRef<XTerm | null>(null);

  const environmentFitAddon = useRef<FitAddon | null>(null);
  const executionFitAddon = useRef<FitAddon | null>(null);

  const [activeTab, setActiveTab] = useState<ConsoleTab>(() => vmManager.getActiveTab());

  const { theme } = useTheme();
  const {
    isTerminalMinimized,
    setIsTerminalMinimized,
    terminalFontSize,
    increaseTerminalFontSize,
    decreaseTerminalFontSize,
    resetTerminalFontSize,
  } = useEditor();
  const [isMaximized, setIsMaximizedState] = useState<boolean>(() => {
    return localStorage.getItem('theprog_terminal_maximized') === 'true';
  });

  const handleToggleMaximize = () => {
    setIsMaximizedState((prev) => {
      const next = !prev;
      localStorage.setItem('theprog_terminal_maximized', String(next));
      return next;
    });
  };

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Sincroniza aba ativa com o vmManager
  useEffect(() => {
    const unsubscribe = vmManager.subscribeActiveTab((tab) => {
      setActiveTab(tab);
    });
    return unsubscribe;
  }, []);

  const getThemeConfig = useCallback(() => {
    return theme === 'dark'
      ? {
          background: '#1e1e1e', // Cor idêntica ao textarea / Monaco dark
          foreground: '#cccccc',
          cursor: '#ffffff',
          selectionBackground: '#264f78',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
        }
      : {
          background: '#ffffff', // Cor idêntica ao textarea / Monaco light
          foreground: '#1e1e1e',
          cursor: '#1e1e1e',
          selectionBackground: '#add6ff',
          black: '#000000',
          red: '#cd3131',
          green: '#008000',
          yellow: '#795e26',
          blue: '#0000ff',
          magenta: '#af00db',
          cyan: '#098658',
          white: '#ffffff',
        };
  }, [theme]);

  const safeFit = useCallback(() => {
    const currentTab = vmManager.getActiveTab();
    if (currentTab === 'environment') {
      if (environmentRef.current && environmentFitAddon.current) {
        const { clientWidth, clientHeight } = environmentRef.current;
        if (clientWidth > 60 && clientHeight > 40) {
          try {
            environmentFitAddon.current.fit();
          } catch {}
        }
      }
    } else {
      if (executionRef.current && executionFitAddon.current) {
        const { clientWidth, clientHeight } = executionRef.current;
        if (clientWidth > 60 && clientHeight > 40) {
          try {
            executionFitAddon.current.fit();
          } catch {}
        }
      }
    }
  }, []);

  const safeFitRef = useRef<() => void>(safeFit);
  safeFitRef.current = safeFit;

  // Inicialização dos dois terminais (Ambiente e Execução)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!environmentRef.current || !executionRef.current) return;

    const termTheme = getThemeConfig();

    // 1. Terminal de Ambiente
    const compTerm = new XTerm({
      cursorBlink: false,
      allowTransparency: true,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: terminalFontSize,
      lineHeight: 1.2,
      theme: termTheme,
    });
    const compFit = new FitAddon();
    const compLinks = new WebLinksAddon();
    compTerm.loadAddon(compFit);
    compTerm.loadAddon(compLinks);
    compTerm.open(environmentRef.current);

    environmentXterm.current = compTerm;
    environmentFitAddon.current = compFit;

    // Ctrl+C no terminal de compilação interrompe compilação
    compTerm.onData((data) => {
      if (data === '\x03') {
        vmManager.stopExecution();
      }
    });

    const unsubComp = vmManager.subscribeEnvironmentOutput((data) => {
      compTerm.write(data);
    });

    // 2. Terminal de Execução
    const execTerm = new XTerm({
      cursorBlink: true,
      allowTransparency: true,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: terminalFontSize,
      lineHeight: 1.2,
      theme: termTheme,
    });
    const execFit = new FitAddon();
    const execLinks = new WebLinksAddon();
    execTerm.loadAddon(execFit);
    execTerm.loadAddon(execLinks);
    execTerm.open(executionRef.current);

    executionXterm.current = execTerm;
    executionFitAddon.current = execFit;

    execTerm.onData((data) => {
      vmManager.sendInput(data);
    });

    const unsubExec = vmManager.subscribeExecutionOutput((data) => {
      execTerm.write(data);
    });

    const handleWindowResize = () => {
      safeFitRef.current();
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => safeFitRef.current());
    });

    if (environmentRef.current) resizeObserver.observe(environmentRef.current);
    if (executionRef.current) resizeObserver.observe(executionRef.current);
    window.addEventListener('resize', handleWindowResize);

    setTimeout(() => safeFitRef.current(), 60);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      unsubComp();
      unsubExec();
      compTerm.dispose();
      execTerm.dispose();
      environmentXterm.current = null;
      executionXterm.current = null;
      environmentFitAddon.current = null;
      executionFitAddon.current = null;
    };
  }, []);

  // Atualiza dinamicamente temas
  useEffect(() => {
    const termTheme = getThemeConfig();
    if (environmentXterm.current) {
      environmentXterm.current.options.theme = termTheme;
    }
    if (executionXterm.current) {
      executionXterm.current.options.theme = termTheme;
    }
  }, [theme, getThemeConfig]);

  // Atualiza tamanho de fonte
  useEffect(() => {
    if (environmentXterm.current) {
      environmentXterm.current.options.fontSize = terminalFontSize;
      try {
        environmentFitAddon.current?.fit();
      } catch {}
    }
    if (executionXterm.current) {
      executionXterm.current.options.fontSize = terminalFontSize;
      try {
        executionFitAddon.current?.fit();
      } catch {}
    }
  }, [terminalFontSize]);

  // Sempre que alternar abas, recalcula dimensões e foca terminal
  useEffect(() => {
    const timer = setTimeout(() => {
      safeFit();
      if (activeTab === 'execution') {
        executionXterm.current?.focus();
      } else {
        environmentXterm.current?.focus();
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [activeTab, safeFit]);

  // Sempre que o terminal for restaurado ou maximizado, recalcula dimensões
  useEffect(() => {
    if (!isTerminalMinimized) {
      const timers = [
        setTimeout(safeFit, 50),
        setTimeout(safeFit, 200),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [isTerminalMinimized, isMaximized, safeFit]);

  // Fecha o menu de contexto ao clicar fora ou apertar ESC
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('theprog-close-context-menu', handleClose);
    window.addEventListener('click', handleClose);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('theprog-close-context-menu', handleClose);
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Eventos globais de foco e limpeza
  useEffect(() => {
    const handleFocus = () => {
      setIsTerminalMinimized(false);
      setTimeout(() => {
        if (vmManager.getActiveTab() === 'environment') {
          environmentXterm.current?.focus();
        } else {
          executionXterm.current?.focus();
        }
      }, 50);
    };

    const handleClearEvent = () => {
      environmentXterm.current?.reset();
      executionXterm.current?.reset();
    };

    window.addEventListener('theprog-focus-console', handleFocus);
    window.addEventListener('theprog-clear-console', handleClearEvent);
    return () => {
      window.removeEventListener('theprog-focus-console', handleFocus);
      window.removeEventListener('theprog-clear-console', handleClearEvent);
    };
  }, [setIsTerminalMinimized]);

  const handleClear = () => {
    if (activeTab === 'environment') {
      environmentXterm.current?.reset();
      vmManager.clearEnvironmentTerminal();
    } else {
      executionXterm.current?.reset();
      vmManager.clearExecutionTerminal();
    }
  };

  const handleCopy = useCallback(async () => {
    setContextMenu(null);
    const term = activeTab === 'environment' ? environmentXterm.current : executionXterm.current;
    const selection = term?.getSelection();
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
      } catch (err) {
        console.warn('Erro ao copiar seleção do terminal:', err);
      }
    }
  }, [activeTab]);

  const handlePaste = useCallback(async () => {
    setContextMenu(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        vmManager.sendInput(text);
      }
    } catch (err) {
      console.warn('Permissão de clipboard necessária para colar no terminal:', err);
    }
  }, []);

  const handleSelectAll = useCallback(() => {
    setContextMenu(null);
    const term = activeTab === 'environment' ? environmentXterm.current : executionXterm.current;
    term?.selectAll();
  }, [activeTab]);

  return (
    <div
      className={`flex flex-col shrink-0 border-t border-[#e5e5e5] dark:border-[#252526] bg-white dark:bg-[#1e1e1e] transition-all duration-150 relative ${
        isTerminalMinimized ? 'h-8' : isMaximized ? 'h-[75vh]' : 'h-52 sm:h-64'
      }`}
    >
      {/* Topo do painel com Abas de Ambiente e Execução */}
      <div className="h-8 px-2 flex items-center justify-between bg-[#ececec] dark:bg-[#252526] select-none text-xs border-b border-[#e5e5e5] dark:border-[#202020] text-[#333333] dark:text-[#cccccc] shrink-0">
        {/* Abas Alternáveis */}
        <div className="flex items-center h-full space-x-1">
          {/* Aba Ambiente */}
          <button
            onClick={() => vmManager.setActiveTab('environment')}
            title="Exibir saída do ambiente (carregamento de runtime, empacotamento, avisos e erros)"
            className={`h-full px-3 flex items-center space-x-1.5 text-xs font-semibold cursor-pointer transition-all relative ${
              activeTab === 'environment'
                ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white'
                : 'text-[#666666] dark:text-[#888888] hover:bg-[#e0e0e0] dark:hover:bg-[#2c2c2d] hover:text-black dark:hover:text-white'
            }`}
          >
            <Hammer className="w-3.5 h-3.5 text-[#007acc] dark:text-[#3794ff]" />
            <span>Ambiente</span>
            {activeTab === 'environment' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#007acc] dark:bg-[#3794ff]" />
            )}
          </button>

          {/* Aba Execução */}
          <button
            onClick={() => vmManager.setActiveTab('execution')}
            title="Exibir saída de execução interativa (stdin, stdout e encerramento)"
            className={`h-full px-3 flex items-center space-x-1.5 text-xs font-semibold cursor-pointer transition-all relative ${
              activeTab === 'execution'
                ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white'
                : 'text-[#666666] dark:text-[#888888] hover:bg-[#e0e0e0] dark:hover:bg-[#2c2c2d] hover:text-black dark:hover:text-white'
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Execução</span>
            {activeTab === 'execution' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-600 dark:bg-emerald-400" />
            )}
          </button>

          {/* Aba Testes & Casos */}
          <button
            onClick={() => vmManager.setActiveTab('tests')}
            title="Painel de Casos de Teste Automatizados (Beecrowd / LeetCode)"
            className={`h-full px-3 flex items-center space-x-1.5 text-xs font-semibold cursor-pointer transition-all relative ${
              activeTab === 'tests'
                ? 'bg-white dark:bg-[#1e1e1e] text-black dark:text-white'
                : 'text-[#666666] dark:text-[#888888] hover:bg-[#e0e0e0] dark:hover:bg-[#2c2c2d] hover:text-black dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Testes & Casos</span>
            {activeTab === 'tests' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-600 dark:bg-purple-400" />
            )}
          </button>
        </div>

        {/* Controles do console */}
        <div className="flex items-center space-x-2 text-[#666666] dark:text-[#aaaaaa]">
          {/* Ajuste de Tamanho da Fonte do Console (A- / A+) */}
          <div
            className="flex items-center bg-[#dedede] dark:bg-[#1e1e1e] border border-[#cccccc] dark:border-[#3e3e42] rounded px-1 py-0.5 space-x-1"
            title="Tamanho da fonte do console"
          >
            <button
              onClick={decreaseTerminalFontSize}
              title="Diminuir fonte do console"
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-[#cccccc] dark:hover:bg-[#383838] font-semibold text-[10px] text-[#444444] dark:text-[#cccccc] cursor-pointer transition-colors"
            >
              A-
            </button>
            <button
              onClick={resetTerminalFontSize}
              title="Clique para redefinir a fonte para 14px"
              className="px-1 text-[10px] font-mono text-[#555555] dark:text-[#aaaaaa] hover:text-[#007acc] dark:hover:text-[#3794ff] cursor-pointer"
            >
              {terminalFontSize}px
            </button>
            <button
              onClick={increaseTerminalFontSize}
              title="Aumentar fonte do console"
              className="w-4 h-4 flex items-center justify-center rounded hover:bg-[#cccccc] dark:hover:bg-[#383838] font-semibold text-[10px] text-[#444444] dark:text-[#cccccc] cursor-pointer transition-colors"
            >
              A+
            </button>
          </div>

          <div className="h-4 w-px bg-[#cccccc] dark:bg-[#3e3e42]" />

          <button
            onClick={handleClear}
            title={`Limpar Aba de ${activeTab === 'environment' ? 'Ambiente' : 'Execução'}`}
            className="p-1 rounded hover:bg-[#dedede] dark:hover:bg-[#333333] hover:text-black dark:hover:text-white cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Restaurar Tamanho' : 'Maximizar Terminal'}
            className="p-1 rounded hover:bg-[#dedede] dark:hover:bg-[#333333] hover:text-black dark:hover:text-white cursor-pointer hidden sm:inline"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsTerminalMinimized(!isTerminalMinimized)}
            title={isTerminalMinimized ? 'Expandir' : 'Minimizar'}
            className="p-1 rounded hover:bg-[#dedede] dark:hover:bg-[#333333] hover:text-black dark:hover:text-white cursor-pointer"
          >
            {isTerminalMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Área dos Terminais Xterm com Menu de Contexto Próprio */}
      <div
        style={{ display: isTerminalMinimized ? 'none' : 'block' }}
        data-terminal-container="true"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(new CustomEvent('theprog-close-context-menu'));
          const menuWidth = 190;
          const menuHeight = 190;
          const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
          const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
          setContextMenu({ x, y });
        }}
        className="flex-1 w-full overflow-hidden bg-white dark:bg-[#1e1e1e] relative"
      >
        <div
          ref={environmentRef}
          style={{ display: activeTab === 'environment' ? 'block' : 'none' }}
          className="w-full h-full"
        />
        <div
          ref={executionRef}
          style={{ display: activeTab === 'execution' ? 'block' : 'none' }}
          className="w-full h-full"
        />
        <div
          style={{ display: activeTab === 'tests' ? 'block' : 'none' }}
          className="w-full h-full"
        >
          <TestRunnerPanel />
        </div>

        {/* Menu de Contexto Útil do Terminal */}
        {contextMenu && (
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 min-w-[190px] py-1.5 bg-[#f3f3f3] dark:bg-[#252526] text-[#333333] dark:text-[#cccccc] rounded-md shadow-2xl border border-[#cccccc] dark:border-[#454545] text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              onClick={handleCopy}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center space-x-2.5">
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </div>
              <span className="text-[10px] opacity-60">Ctrl+Shift+C</span>
            </button>

            {activeTab === 'execution' && (
              <button
                onClick={handlePaste}
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
              >
                <div className="flex items-center space-x-2.5">
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Colar</span>
                </div>
                <span className="text-[10px] opacity-60">Ctrl+Shift+V</span>
              </button>
            )}

            <button
              onClick={handleSelectAll}
              className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center space-x-2.5">
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Selecionar Tudo</span>
              </div>
            </button>

            <div className="my-1 border-t border-[#e0e0e0] dark:border-[#383838]" />

            <button
              onClick={() => {
                setContextMenu(null);
                handleClear();
              }}
              className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Aba</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
