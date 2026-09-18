import React from 'react';
import { Play, Square, Sparkles, Sun, Moon, Wifi, WifiOff, Terminal, Download } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { APP_VERSION } from '../../config/version';

interface TitleBarProps {
  onOpenSettings?: () => void;
  onOpenVMModal: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenVMModal }) => {
  const {
    runActiveFile,
    stopExecution,
    formatActiveFile,
    vmStatus,
    isSystemReady,
    systemStatus,
    systemProgressPercent,
    systemStatusMessage,
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
  } = useEditor();
  const { theme, toggleTheme } = useTheme();
  const isOnline = useNetworkStatus();
  const { isInstallable, installApp } = usePwaInstall();

  return (
    <header className="h-9 w-full bg-[#f3f3f3] dark:bg-[#181818] border-b border-[#e5e5e5] dark:border-[#252526] flex items-center justify-between px-3 select-none text-xs text-[#333333] dark:text-[#cccccc] transition-colors shrink-0">
      {/* Esquerda: Logo e Nome */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 font-semibold text-[#007acc] dark:text-[#3794ff]">
          <Terminal className="w-4 h-4" />
          <span className="tracking-wide font-bold">TheProg Editor</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#007acc]/10 dark:bg-[#3794ff]/15 text-[#007acc] dark:text-[#3794ff] border border-[#007acc]/25 dark:border-[#3794ff]/25 font-normal ml-1 select-none">
            v{APP_VERSION}
          </span>
        </div>
      </div>

      {/* Direita: Ações principais */}
      <div className="flex items-center space-x-2">
        {/* Botão Dinâmico Executar / Stop (F5 / Kill) - Apenas Ícone */}
        {vmStatus === 'running' ? (
          <button
            onClick={() => stopExecution()}
            title="Interromper Execução (Ctrl+C / Kill)"
            className="flex items-center justify-center w-7 h-7 rounded font-medium text-white shadow-xs transition-all bg-[#e51400] hover:bg-[#c91000] active:scale-95 cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={() => runActiveFile()}
            disabled={!isSystemReady}
            title={
              !isSystemReady
                ? `Aguarde o carregamento do Sistema (${systemProgressPercent}%)... O botão será ativado assim que 100% pronto.`
                : 'Salvar e Executar Código (F5)'
            }
            className={`flex items-center justify-center w-7 h-7 rounded font-medium text-white shadow-xs transition-all ${
              !isSystemReady
                ? 'bg-neutral-400 dark:bg-neutral-600 opacity-50 cursor-not-allowed'
                : 'bg-[#238636] hover:bg-[#2ea043] active:scale-95 cursor-pointer'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </button>
        )}

        {/* Botão Formatar Código (Shift+Alt+F) */}
        <button
          onClick={formatActiveFile}
          title="Formatar Código (Shift+Alt+F)"
          className="flex items-center space-x-1 px-2.5 py-1 rounded font-medium text-xs bg-[#dedede] hover:bg-[#d5d5d5] dark:bg-[#2d2d2d] dark:hover:bg-[#383838] text-[#333333] dark:text-[#cccccc] border border-[#cccccc] dark:border-[#3e3e42] shadow-xs active:scale-95 cursor-pointer transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline">Formatar</span>
        </button>

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

        {/* Badge Unificado do Sistema (Compilador Clang WebAssembly + Linux v86) */}
        {systemStatus === 'loading' && (
          <button
            onClick={onOpenVMModal}
            title={`Sistema carregando (${systemProgressPercent}%). Compilador Clang e Linux em inicialização. Clique para detalhes.`}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/60 text-[11px] text-blue-700 dark:text-blue-300 select-none animate-pulse cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span className="font-medium">Sistema {systemProgressPercent}%</span>
          </button>
        )}

        {systemStatus === 'ready' && (
          <button
            onClick={onOpenVMModal}
            title="Sistema 100% pronto (Clang C/C++ WebAssembly e Linux integrados). Clique para ver detalhes."
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/50 text-[11px] text-emerald-700 dark:text-emerald-300 select-none cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium">Sistema</span>
          </button>
        )}

        {systemStatus === 'running' && (
          <button
            onClick={onOpenVMModal}
            title="Sistema executando código... Clique para ver detalhes."
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-300 select-none animate-pulse cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-medium">Sistema</span>
          </button>
        )}

        {systemStatus === 'error' && (
          <button
            onClick={onOpenVMModal}
            title={`Erro no Sistema: ${systemStatusMessage}. Clique para ver detalhes e reconectar.`}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="font-medium">Sistema: Erro</span>
          </button>
        )}

        {/* Badge Online / Offline em tempo real (Apenas Ícone) */}
        <div
          title={
            isOnline
              ? 'Conectado à internet (Online)'
              : 'Sem conexão com a internet (Offline). O TheProg Editor opera 100% autônomo via PWA.'
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

        {/* Alternador de Tema */}
        <button
          onClick={toggleTheme}
          title={`Mudar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
          className="p-1 rounded hover:bg-[#d8d8d8] dark:hover:bg-[#2a2d2e] cursor-pointer text-[#333333] dark:text-[#cccccc]"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};
