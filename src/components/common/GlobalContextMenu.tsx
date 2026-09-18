import React, { useEffect, useState } from 'react';
import {
  FilePlus,
  Play,
  Sparkles,
  Terminal,
  Sun,
  Moon,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';

interface MenuPosition {
  x: number;
  y: number;
}

interface GlobalContextMenuProps {
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export const GlobalContextMenu: React.FC<GlobalContextMenuProps> = ({
  onOpenSettings,
  onOpenHelp,
}) => {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const { createNewFile, runActiveFile, formatActiveFile, resetTerminal } = useEditor();
  const { theme, toggleTheme } = useTheme();
  const { showPrompt } = useDialog();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Impede o menu de contexto padrão do navegador em qualquer elemento
      e.preventDefault();

      const target = e.target as HTMLElement | null;

      // Se o clique veio de áreas com menu de contexto próprio, delega e não abre o menu global:
      if (
        target?.closest('.monaco-editor') ||
        target?.closest('.monaco-menu') ||
        target?.closest('aside') || // Explorador de arquivos (Sidebar)
        target?.closest('[data-context-menu="sidebar"]') ||
        target?.closest('[data-terminal-container]') ||
        target?.closest('[data-tab-item]')
      ) {
        setPosition(null);
        return;
      }

      // Fecha qualquer outro menu aberto antes de abrir o global
      window.dispatchEvent(new CustomEvent('theprog-close-context-menu'));

      // Abre o menu de contexto global customizado
      const menuWidth = 200;
      const menuHeight = 240;
      const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
      const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
      setPosition({ x, y });
    };

    const handleClose = () => setPosition(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPosition(null);
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('theprog-close-context-menu', handleClose);
    window.addEventListener('click', handleClose);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('theprog-close-context-menu', handleClose);
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!position) return null;

  const handleCreateFile = async () => {
    setPosition(null);
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

  return (
    <div
      style={{ top: position.y, left: position.x }}
      className="fixed z-50 min-w-[200px] py-1.5 bg-[#f3f3f3] dark:bg-[#252526] text-[#333333] dark:text-[#cccccc] rounded-md shadow-2xl border border-[#cccccc] dark:border-[#454545] text-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <button
        onClick={handleCreateFile}
        className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
      >
        <FilePlus className="w-3.5 h-3.5 text-[#007acc] dark:text-[#3794ff]" />
        <span>Novo Arquivo</span>
      </button>

      <button
        onClick={() => {
          setPosition(null);
          runActiveFile();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
      >
        <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-current" />
        <span>Executar Código (F5)</span>
      </button>

      <button
        onClick={() => {
          setPosition(null);
          formatActiveFile();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Formatar Código</span>
      </button>

      <div className="my-1 border-t border-[#e5e5e5] dark:border-[#383838]" />

      <button
        onClick={() => {
          setPosition(null);
          resetTerminal();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
      >
        <Terminal className="w-3.5 h-3.5 text-[#777777] dark:text-[#aaaaaa]" />
        <span>Limpar Terminal</span>
      </button>

      <button
        onClick={() => {
          setPosition(null);
          toggleTheme();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
      >
        {theme === 'dark' ? (
          <Sun className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-slate-600" />
        )}
        <span>Mudar para Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
      </button>

      <div className="my-1 border-t border-[#e5e5e5] dark:border-[#383838]" />

      <button
        onClick={() => {
          setPosition(null);
          onOpenSettings();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
      >
        <Settings className="w-3.5 h-3.5 text-[#777777] dark:text-[#aaaaaa]" />
        <span>Configurações</span>
      </button>

      <button
        onClick={() => {
          setPosition(null);
          onOpenHelp();
        }}
        className="w-full px-3 py-1.5 flex items-center space-x-2.5 hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors text-left"
      >
        <HelpCircle className="w-3.5 h-3.5 text-[#777777] dark:text-[#aaaaaa]" />
        <span>Ajuda & Recursos</span>
      </button>
    </div>
  );
};
