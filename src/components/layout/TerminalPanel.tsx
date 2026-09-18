import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as TerminalIcon, Trash2, ChevronUp, ChevronDown, Maximize2, Minimize2, FileInput, X } from 'lucide-react';
import { vmManager } from '../../services/vmManager';
import { useTheme } from '../../context/ThemeContext';
import { useEditor } from '../../context/EditorContext';

export const TerminalPanel: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { theme } = useTheme();
  const { isTerminalMinimized, setIsTerminalMinimized } = useEditor();
  const [isMaximized, setIsMaximized] = useState(false);
  const [stdinValue, setStdinValue] = useState(() => vmManager.getCustomStdin());
  const [showStdin, setShowStdin] = useState(() => Boolean(vmManager.getCustomStdin().trim()));

  useEffect(() => {
    return vmManager.subscribeStdin((val) => {
      setStdinValue(val);
    });
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Instancia o Xterm com fundo exatamente idêntico ao Monaco Editor (#1e1e1e escuro / #ffffff claro)
    const term = new XTerm({
      cursorBlink: true,
      allowTransparency: true,
      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
      fontSize: 13,
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

    // Padrão Linux clean
    term.write(vmManager.PROMPT);

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

  const handleClear = () => {
    if (xtermInstance.current) {
      xtermInstance.current.reset();
    }
    vmManager.clearTerminal();
  };

  return (
    <div
      className={`flex flex-col border-t border-[#e5e5e5] dark:border-[#252526] bg-white dark:bg-[#1e1e1e] transition-all duration-150 ${
        isTerminalMinimized ? 'h-8' : isMaximized ? 'h-[75vh]' : 'h-64'
      }`}
    >
      {/* Topo do painel de Terminal */}
      <div className="h-8 px-3 flex items-center justify-between bg-[#ececec] dark:bg-[#252526] select-none text-xs border-b border-[#e5e5e5] dark:border-[#202020] text-[#333333] dark:text-[#cccccc] shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-semibold text-black dark:text-white">
            <TerminalIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="tracking-wide text-[11px]">TERMINAL</span>
          </div>

          {/* Botão para alternar painel de Entrada Padrão (stdin) */}
          <button
            onClick={() => setShowStdin(!showStdin)}
            title="Configurar entrada padrão (stdin) para programas com scanf/cin"
            className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
              showStdin
                ? 'bg-emerald-600 text-white dark:bg-emerald-600'
                : stdinValue.trim()
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-[#dedede] dark:bg-[#333333] hover:bg-[#d0d0d0] dark:hover:bg-[#3e3e3e] text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <FileInput className="w-3 h-3" />
            <span>Entrada (stdin)</span>
            {stdinValue.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            )}
          </button>
        </div>

        {/* Controles limpos do terminal */}
        <div className="flex items-center space-x-1 text-[#666666] dark:text-[#aaaaaa]">
          <button
            onClick={handleClear}
            title="Limpar Terminal"
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

      {/* Gaveta de Entrada Stdin (para programas que utilizam scanf / cin) */}
      {!isTerminalMinimized && showStdin && (
        <div className="px-3 py-2 border-b border-[#e5e5e5] dark:border-[#202020] bg-[#f8f9fa] dark:bg-[#181818] flex flex-col gap-1.5 text-xs shrink-0">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">
              Entrada Padrão (stdin) para scanf / cin:
            </span>
            <div className="flex items-center space-x-2">
              {stdinValue && (
                <button
                  onClick={() => vmManager.setCustomStdin('')}
                  className="hover:text-red-500 text-[11px] cursor-pointer"
                >
                  Limpar
                </button>
              )}
              <button
                onClick={() => setShowStdin(false)}
                className="hover:text-neutral-800 dark:hover:text-white p-0.5 cursor-pointer"
                title="Fechar gaveta de entrada"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <textarea
            value={stdinValue}
            onChange={(e) => vmManager.setCustomStdin(e.target.value)}
            placeholder="Digite os dados para o programa (ex: 10 20)... Eles serão consumidos automaticamente por scanf() ou cin."
            rows={2}
            className="w-full px-2.5 py-1.5 rounded border border-[#d0d0d0] dark:border-[#333333] bg-white dark:bg-[#1e1e1e] text-[#1e1e1e] dark:text-[#cccccc] font-mono text-xs resize-none focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      )}

      {/* Área do Terminal Xterm - fundo exatamente idêntico ao editor */}
      <div
        style={{ display: isTerminalMinimized ? 'none' : 'block' }}
        className="flex-1 w-full overflow-hidden bg-white dark:bg-[#1e1e1e]"
      >
        <div ref={terminalRef} className="w-full h-full" />
      </div>
    </div>
  );
};
