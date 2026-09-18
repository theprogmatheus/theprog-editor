import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import {
  Terminal as TerminalIcon,
  Trash2,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  Copy,
  ClipboardPaste,
  CheckSquare,
} from 'lucide-react';
import { vmManager } from '../../services/vmManager';
import { useTheme } from '../../context/ThemeContext';
import { useEditor } from '../../context/EditorContext';

export const TerminalPanel: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { theme } = useTheme();
  const {
    isTerminalMinimized,
    setIsTerminalMinimized,
    terminalFontSize,
    increaseTerminalFontSize,
    decreaseTerminalFontSize,
    resetTerminalFontSize,
  } = useEditor();
  const [isMaximized, setIsMaximized] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Instancia o Xterm com fundo exatamente idêntico ao Monaco Editor (#1e1e1e escuro / #ffffff claro)
    const initialFontSize = terminalFontSize;
    const term = new XTerm({
      cursorBlink: true,
      allowTransparency: true,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: initialFontSize,
      lineHeight: 1.2,
      theme:
        theme === 'dark'
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
            },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      vmManager.sendInput(data);
    });

    const unsubscribe = vmManager.subscribeOutput((data) => {
      term.write(data);
    });

    // ResizeObserver resiliente para nunca encolher ou corromper o canvas
    const safeFit = () => {
      if (terminalRef.current && fitAddonRef.current) {
        const { clientWidth, clientHeight } = terminalRef.current;
        if (clientWidth > 60 && clientHeight > 40) {
          try {
            fitAddonRef.current.fit();
          } catch (e) {
            // ignore fit errors during rapid unmount
          }
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(safeFit);
    });

    resizeObserver.observe(terminalRef.current);
    window.addEventListener('resize', safeFit);

    // Ajuste inicial com pequeno delay para garantir dimensões do container
    setTimeout(safeFit, 60);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', safeFit);
      unsubscribe();
      term.dispose();
    };
  }, [theme]);

  // Sempre que o terminal for restaurado ou maximizado, recalcula dimensões
  useEffect(() => {
    if (!isTerminalMinimized) {
      const timers = [
        setTimeout(() => {
          if (terminalRef.current && fitAddonRef.current) {
            try {
              fitAddonRef.current.fit();
            } catch (e) {}
          }
        }, 50),
        setTimeout(() => {
          if (terminalRef.current && fitAddonRef.current) {
            try {
              fitAddonRef.current.fit();
            } catch (e) {}
          }
        }, 200),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [isTerminalMinimized, isMaximized]);

  // Atualiza a fonte do terminal dinamicamente quando alterada
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.fontSize = terminalFontSize;
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {}
      }
    }
  }, [terminalFontSize]);

  // Fecha o menu de contexto do terminal ao clicar fora, apertar ESC ou abrir outro menu
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

  // Foco automático imediato e limpeza do console ao clicar em Executar ou apertar F5
  useEffect(() => {
    const handleFocus = () => {
      setIsTerminalMinimized(false);
      setTimeout(() => {
        xtermInstance.current?.focus();
      }, 50);
    };

    const handleClearEvent = () => {
      if (xtermInstance.current) {
        xtermInstance.current.reset();
      }
    };

    window.addEventListener('theprog-focus-console', handleFocus);
    window.addEventListener('theprog-clear-console', handleClearEvent);
    return () => {
      window.removeEventListener('theprog-focus-console', handleFocus);
      window.removeEventListener('theprog-clear-console', handleClearEvent);
    };
  }, [setIsTerminalMinimized]);

  const handleClear = () => {
    if (xtermInstance.current) {
      xtermInstance.current.reset();
    }
    vmManager.clearTerminal();
  };

  const handleCopy = useCallback(async () => {
    setContextMenu(null);
    const selection = xtermInstance.current?.getSelection();
    if (selection) {
      try {
        await navigator.clipboard.writeText(selection);
      } catch (err) {
        console.warn('Erro ao copiar seleção do terminal:', err);
      }
    }
  }, []);

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
    xtermInstance.current?.selectAll();
  }, []);

  return (
    <div
      className={`flex flex-col border-t border-[#e5e5e5] dark:border-[#252526] bg-white dark:bg-[#1e1e1e] transition-all duration-150 relative ${
        isTerminalMinimized ? 'h-8' : isMaximized ? 'h-[75vh]' : 'h-52 sm:h-64'
      }`}
    >
      {/* Topo do painel de Console */}
      <div className="h-8 px-3 flex items-center justify-between bg-[#ececec] dark:bg-[#252526] select-none text-xs border-b border-[#e5e5e5] dark:border-[#202020] text-[#333333] dark:text-[#cccccc] shrink-0">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 font-semibold text-black dark:text-white">
            <TerminalIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="tracking-wide text-[11px]">CONSOLE DE EXECUÇÃO</span>
          </div>
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
            title="Limpar Console"
            className="p-1 rounded hover:bg-[#dedede] dark:hover:bg-[#333333] hover:text-black dark:hover:text-white cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
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

      {/* Área do Terminal Xterm com Menu de Contexto Próprio */}
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
        <div ref={terminalRef} className="w-full h-full" />

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
              <span>Limpar Console</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
