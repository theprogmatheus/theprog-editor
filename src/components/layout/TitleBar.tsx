import React, { useState } from 'react';
import { Play, Square, Sun, Moon, Wifi, WifiOff, Terminal, Download, FolderOpen, Box, BookOpen } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { getRunCapability } from '../../services/languages/runCapability';
import { APP_VERSION } from '../../config/version';
import { SnippetLibraryModal } from '../modals/SnippetLibraryModal';

interface TitleBarProps {
  onOpenSettings?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = () => {
  const {
    runActiveFile,
    stopExecution,
    vmStatus,
    activeFile,
    runtimes,
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    activeWorkspace,
    openWorkspacePicker,
  } = useEditor();
  const { theme, toggleTheme } = useTheme();
  const isOnline = useNetworkStatus();
  const { isInstallable, installApp } = usePwaInstall();
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);

  const capability = getRunCapability(activeFile, runtimes);

  return (
    <header className="h-9 w-full bg-[#f3f3f3] dark:bg-[#181818] border-b border-[#e5e5e5] dark:border-[#252526] flex items-center justify-between px-3 select-none text-xs text-[#333333] dark:text-[#cccccc] transition-colors shrink-0">
      {/* Esquerda: Logo, Nome e Workspace Ativo */}
      <div className="flex items-center space-x-2.5">
        <div className="flex items-center space-x-1.5 font-semibold text-[#007acc] dark:text-[#3794ff]">
          <Terminal className="w-4 h-4" />
          <span className="tracking-wide font-bold">TheProg Editor</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#007acc]/10 dark:bg-[#3794ff]/15 text-[#007acc] dark:text-[#3794ff] border border-[#007acc]/25 dark:border-[#3794ff]/25 font-normal ml-1 select-none">
            v{APP_VERSION}
          </span>
        </div>

        {/* Botão de Selecionar Workspace */}
        <button
          onClick={openWorkspacePicker}
          title={`Espaço de trabalho ativo: ${activeWorkspace.name} (${
            activeWorkspace.type === 'local' ? 'Disco Local' : 'Sandbox Virtual'
          }). Clique para trocar.`}
          className={`hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
            activeWorkspace.type === 'local'
              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/40'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/40'
          }`}
        >
          {activeWorkspace.type === 'local' ? (
            <FolderOpen className="w-3.5 h-3.5" />
          ) : (
            <Box className="w-3.5 h-3.5" />
          )}
          <span className="max-w-[130px] truncate">{activeWorkspace.name}</span>
        </button>
      </div>

      {/* Direita: Ações principais */}
      <div className="flex items-center space-x-2">
        {/* Botão Dinâmico Compilar & Executar / Interromper (F5 / Kill) */}
        {vmStatus === 'running' ? (
          <button
            onClick={() => stopExecution()}
            title="Interromper Execução (Ctrl+C / Kill)"
            className="flex items-center space-x-1.5 px-3 h-7 rounded font-semibold text-xs text-white shadow-xs transition-all bg-[#e51400] hover:bg-[#c91000] active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Interromper</span>
          </button>
        ) : (
          <button
            onClick={() => runActiveFile()}
            disabled={!capability.canRun}
            title={
              capability.canRun
                ? `${capability.label} (F5)`
                : capability.reason || 'Execução indisponível para este arquivo'
            }
            className={`flex items-center space-x-1.5 px-3 h-7 rounded font-semibold text-xs text-white shadow-xs transition-all whitespace-nowrap ${
              !capability.canRun
                ? 'bg-neutral-400 dark:bg-neutral-600 opacity-50 cursor-not-allowed'
                : 'bg-[#238636] hover:bg-[#2ea043] active:scale-95 cursor-pointer shadow-sm'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{capability.label}</span>
          </button>
        )}

        {/* Ajuste de Tamanho da Fonte (A- / A+) */}
        <div
          className="flex items-center bg-[#dedede] dark:bg-[#252526] border border-[#cccccc] dark:border-[#3e3e42] rounded px-1 py-0.5 space-x-1"
          title="Tamanho da fonte do editor (Atalhos: Ctrl++ / Ctrl+- / Ctrl+0)"
        >
          <button
            onClick={decreaseFontSize}
            title="Diminuir tamanho da fonte (Ctrl+-)"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#cccccc] dark:hover:bg-[#383838] font-semibold text-[11px] text-[#444444] dark:text-[#cccccc] cursor-pointer transition-colors"
          >
            A-
          </button>
          <button
            onClick={resetFontSize}
            title="Clique para redefinir para o padrão 14px (Ctrl+0)"
            className="px-1 text-[11px] font-mono text-[#555555] dark:text-[#aaaaaa] hover:text-[#007acc] dark:hover:text-[#3794ff] cursor-pointer"
          >
            {fontSize}px
          </button>
          <button
            onClick={increaseFontSize}
            title="Aumentar tamanho da fonte (Ctrl++)"
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#cccccc] dark:hover:bg-[#383838] font-semibold text-[11px] text-[#444444] dark:text-[#cccccc] cursor-pointer transition-colors"
          >
            A+
          </button>
        </div>


        {/* Badge Online / Offline em tempo real (Apenas Ícone) */}
        <div
          title={
            isOnline
              ? 'Conectado à internet (Online)'
              : 'Sem conexão com a internet (Offline). Após o primeiro acesso, o TheProg Editor opera de forma autônoma via PWA.'
          }
          className={`hidden md:flex items-center justify-center w-6 h-6 rounded border transition-colors ${
            isOnline
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/50'
          }`}
        >
          {isOnline ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          )}
        </div>

        {/* Botão Instalar PWA */}
        {isInstallable && (
          <button
            onClick={() => installApp()}
            title="Instalar TheProg Editor como aplicativo no seu computador ou celular"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded font-medium text-xs bg-[#007acc] hover:bg-[#0062a3] dark:bg-[#007acc] dark:hover:bg-[#008be6] text-white shadow-xs active:scale-95 cursor-pointer transition-all animate-pulse hover:animate-none"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-semibold">Instalar App</span>
          </button>
        )}

        {/* Catálogo de Algoritmos & Snippets */}
        <button
          onClick={() => setIsSnippetModalOpen(true)}
          title="Abrir Catálogo de Algoritmos & Estruturas Didáticas"
          className="p-1 rounded hover:bg-[#d8d8d8] dark:hover:bg-[#2a2d2e] cursor-pointer text-[#333333] dark:text-[#cccccc] transition-colors"
        >
          <BookOpen className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
        </button>

        {/* Alternador de Tema */}
        <button
          onClick={toggleTheme}
          title={`Mudar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
          className="p-1 rounded hover:bg-[#d8d8d8] dark:hover:bg-[#2a2d2e] cursor-pointer text-[#333333] dark:text-[#cccccc]"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>

      <SnippetLibraryModal
        isOpen={isSnippetModalOpen}
        onClose={() => setIsSnippetModalOpen(false)}
      />
    </header>
  );
};
