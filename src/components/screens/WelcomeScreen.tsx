import React, { useState } from 'react';
import {
  FolderOpen,
  Box,
  Clock,
  Trash2,
  Terminal,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import type { RecentWorkspace } from '../../types/editor';
import { APP_VERSION } from '../../config/version';
import { isFileSystemAccessSupported } from '../../services/localFs';
import { useTheme } from '../../context/ThemeContext';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useEditor } from '../../context/EditorContext';

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Agora há pouco';
  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffHour < 24) return `Há ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

interface WelcomeScreenProps {
  recentWorkspaces: RecentWorkspace[];
  onOpenLocalFolder: () => Promise<void>;
  onSelectRecent: (workspace: RecentWorkspace) => Promise<void>;
  onRemoveRecent: (id: string) => Promise<void>;
  onOpenSandbox: () => Promise<void>;
  canReturnToEditor?: boolean;
  onReturnToEditor?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  recentWorkspaces,
  onOpenLocalFolder,
  onSelectRecent,
  onRemoveRecent,
  onOpenSandbox,
  canReturnToEditor = false,
  onReturnToEditor,
}) => {
  const isSupported = isFileSystemAccessSupported();
  const { theme, toggleTheme } = useTheme();
  const isOnline = useNetworkStatus();
  const { alwaysOpenLast, setAlwaysOpenLast } = useEditor();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToggleAlwaysOpenLast = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAlwaysOpenLast(e.target.checked);
  };

  const handleOpenFolderClick = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await onOpenLocalFolder();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setErrorMessage(err?.message || 'Não foi possível acessar a pasta selecionada.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRecentItem = async (workspace: RecentWorkspace) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await onSelectRecent(workspace);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao carregar o espaço de trabalho.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSandboxClick = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await onOpenSandbox();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao abrir o Sandbox.');
    } finally {
      setIsLoading(false);
    }
  };

  const localRecentWorkspaces = recentWorkspaces.filter((w) => w.type === 'local');

  return (
    <div className="h-screen w-screen overflow-y-auto bg-[#f8f9fa] dark:bg-[#121212] text-[#333333] dark:text-[#cccccc] select-none flex flex-col justify-between transition-colors">
      {/* Barra de Topo da Tela de Boas-Vindas */}
      <header className="h-14 px-6 border-b border-[#e5e5e5] dark:border-[#222222] flex items-center justify-between bg-white/70 dark:bg-[#181818]/70 backdrop-blur-md shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-[#007acc]/10 dark:bg-[#007acc]/20 text-[#007acc] dark:text-[#3794ff] flex items-center justify-center border border-[#007acc]/30">
            <Terminal className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm tracking-wide text-black dark:text-white">
              TheProg Editor
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-[#555555] dark:text-[#aaaaaa] border border-neutral-300 dark:border-neutral-700">
              v{APP_VERSION}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Badge Online/Offline */}
          <div
            title={isOnline ? 'Conectado à rede' : 'Sem conexão com a internet (operando em modo offline resiliente)'}
            className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] border border-[#e0e0e0] dark:border-[#333333]"
          >
            {isOnline ? (
              <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            )}
            <span className="hidden sm:inline text-[#666666] dark:text-[#999999]">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Alternar Tema */}
          <button
            onClick={toggleTheme}
            title={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
            className="p-1.5 rounded-lg border border-[#e0e0e0] dark:border-[#333333] hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer text-[#555555] dark:text-[#cccccc] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Botão de Retornar ao Editor caso já haja um projeto ativo */}
          {canReturnToEditor && onReturnToEditor && (
            <button
              onClick={onReturnToEditor}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-semibold cursor-pointer shadow-xs transition-all"
            >
              <span>Voltar ao Editor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Central */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 flex flex-col justify-center space-y-8">
        {/* Banner / Hero */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-black dark:text-white">
            Espaço de Trabalho
          </h1>
          <p className="text-xs md:text-sm text-[#666666] dark:text-[#999999] max-w-lg mx-auto">
            Utilize o Sandbox virtual no navegador ou abra uma pasta do computador para sincronização direta no disco.
          </p>
        </div>

        {/* Mensagem de Erro (se houver) */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Aviso quando o navegador não possui suporte à File System Access API nativa */}
        {!isSupported && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-3 shadow-xs">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Navegador sem suporte a diretórios locais no disco</p>
              <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                A abertura direta de pastas físicas e a resiliência completa a oscilações de rede (PWA) são garantidas em navegadores baseados em Chromium (como <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong> ou <strong>Brave</strong>). Neste navegador, você pode utilizar com total funcionalidade o <strong>Workspace Sandbox</strong> virtual.
              </p>
            </div>
          </div>
        )}

        {/* Cards de Ação Primária (Sandbox em primeiro lugar) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Workspace Sandbox (PRIMEIRO) */}
          <button
            onClick={handleOpenSandboxClick}
            disabled={isLoading}
            className="p-5 rounded-2xl border border-[#e0e0e0] dark:border-[#2a2a2a] bg-white dark:bg-[#181818] hover:border-amber-500/50 hover:shadow-xl transition-all text-left flex flex-col justify-between group cursor-pointer hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Box className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Isolado
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-black dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Workspace Sandbox (Navegador)
              </h3>
              <p className="text-xs text-[#666666] dark:text-[#888888] mt-1.5 leading-relaxed">
                Ambiente virtual isolado no navegador, persistido no IndexedDB e resistente a oscilações e falta de internet.
              </p>
            </div>
          </button>

          {/* Card 2: Abrir Pasta Local (SEGUNDO) */}
          <button
            onClick={handleOpenFolderClick}
            disabled={isLoading || !isSupported}
            className={`p-5 rounded-2xl border text-left transition-all flex flex-col justify-between group ${
              isSupported
                ? 'border-[#007acc]/40 dark:border-[#007acc]/30 bg-blue-50/50 dark:bg-[#007acc]/10 hover:border-[#007acc] hover:shadow-xl cursor-pointer hover:-translate-y-0.5'
                : 'border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 opacity-60 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#007acc]/15 text-[#007acc] dark:text-[#3794ff] flex items-center justify-center">
                <FolderOpen className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#007acc]/10 text-[#007acc] dark:text-[#3794ff] border border-[#007acc]/20">
                Disco do Computador
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-black dark:text-white group-hover:text-[#007acc] dark:group-hover:text-[#3794ff] transition-colors">
                Abrir Pasta do Computador...
              </h3>
              <p className="text-xs text-[#666666] dark:text-[#888888] mt-1.5 leading-relaxed">
                {isSupported
                  ? 'Edições e arquivos gerados por compilações em C refletem diretamente na pasta física.'
                  : 'Requer navegador baseado em Chromium (Chrome, Edge, Brave).'}
              </p>
            </div>
          </button>
        </div>

        {/* Seção de Diretórios Recentes no Disco (exibida apenas quando há suporte a pastas no disco) */}
        {isSupported && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#616161] dark:text-[#888888] flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Diretórios Recentes no Disco</span>
              </h2>
              <span className="text-xs text-[#888888]">
                {localRecentWorkspaces.length} {localRecentWorkspaces.length === 1 ? 'pasta recente' : 'pastas recentes'}
              </span>
            </div>

            <div className="border border-[#e0e0e0] dark:border-[#262626] rounded-2xl overflow-hidden divide-y divide-[#e5e5e5] dark:divide-[#262626] bg-white dark:bg-[#181818] shadow-sm">
              {localRecentWorkspaces.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#888888]">
                  Nenhum diretório recente ainda. Abra uma pasta acima para começar a programar!
                </div>
              ) : (
                localRecentWorkspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    onClick={() => handleSelectRecentItem(workspace)}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-[#202020] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0 flex-1 mr-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#007acc]/10 text-[#007acc] dark:text-[#3794ff]">
                        <FolderOpen className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-black dark:text-white truncate group-hover:text-[#007acc] dark:group-hover:text-[#3794ff] transition-colors">
                            {workspace.name}
                          </span>
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            Disco
                          </span>
                        </div>
                        <p className="text-[11px] text-[#777777] dark:text-[#888888] truncate mt-0.5">
                          {workspace.path || 'Pasta no sistema operacional'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="text-xs text-[#888888]">
                        {formatRelativeTime(workspace.lastOpened)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecent(workspace.id);
                        }}
                        title="Remover do histórico"
                        className="p-1.5 rounded-lg text-[#888888] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Opção de Preferência no Rodapé */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-2 text-xs text-[#666666] dark:text-[#888888] gap-3">
          <label className="flex items-center space-x-2 cursor-pointer select-none hover:text-black dark:hover:text-white transition-colors">
            <input
              type="checkbox"
              checked={alwaysOpenLast}
              onChange={handleToggleAlwaysOpenLast}
              className="rounded text-[#007acc] focus:ring-0 cursor-pointer"
            />
            <span>Sempre abrir o último projeto automaticamente</span>
          </label>

          <span className="text-[11px] font-mono text-[#888888]">
            C/C++, Python, JavaScript e TypeScript em WebAssembly
          </span>
        </div>
      </main>

      {/* Rodapé institucional */}
      <footer className="h-10 px-6 border-t border-[#e5e5e5] dark:border-[#222222] flex items-center justify-center text-[11px] text-[#888888] bg-white/40 dark:bg-[#181818]/40 shrink-0">
        <span>TheProg Editor &copy; &bull; Offline após o primeiro acesso &bull; Privacidade Total</span>
      </footer>
    </div>
  );
};
