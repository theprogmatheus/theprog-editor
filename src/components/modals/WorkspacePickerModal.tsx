import React, { useState } from 'react';
import {
  FolderOpen,
  Box,
  Clock,
  Trash2,
  X,
  Terminal,
  AlertCircle,
  Check,
} from 'lucide-react';
import type { RecentWorkspace } from '../../types/editor';
import { APP_VERSION } from '../../config/version';
import { isFileSystemAccessSupported } from '../../services/localFs';

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

interface WorkspacePickerModalProps {
  isOpen: boolean;
  onClose?: () => void;
  recentWorkspaces: RecentWorkspace[];
  currentWorkspaceId?: string;
  onOpenLocalFolder: () => Promise<void>;
  onSelectRecent: (workspace: RecentWorkspace) => Promise<void>;
  onRemoveRecent: (id: string) => Promise<void>;
  onOpenSandbox: () => Promise<void>;
  canCloseWithoutSelection?: boolean;
}

export const WorkspacePickerModal: React.FC<WorkspacePickerModalProps> = ({
  isOpen,
  onClose,
  recentWorkspaces,
  currentWorkspaceId,
  onOpenLocalFolder,
  onSelectRecent,
  onRemoveRecent,
  onOpenSandbox,
  canCloseWithoutSelection = false,
}) => {
  const isSupported = isFileSystemAccessSupported();
  const [alwaysOpenLast, setAlwaysOpenLast] = useState<boolean>(() => {
    return localStorage.getItem('theprog_always_open_last_workspace') === 'true';
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleAlwaysOpenLast = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAlwaysOpenLast(checked);
    localStorage.setItem('theprog_always_open_last_workspace', String(checked));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#1e1e1e] border border-[#e0e0e0] dark:border-[#2e2e2e] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#333333] dark:text-[#cccccc] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-[#e5e5e5] dark:border-[#2a2a2a] flex items-center justify-between bg-[#f8f8f8] dark:bg-[#181818]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#007acc]/10 dark:bg-[#007acc]/20 text-[#007acc] flex items-center justify-center border border-[#007acc]/30">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-wide text-black dark:text-white">
                  TheProg Editor
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 text-[#666666] dark:text-[#aaaaaa] border border-neutral-300 dark:border-neutral-700">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-[#666666] dark:text-[#999999]">
                Selecione um espaço de trabalho para começar
              </p>
            </div>
          </div>

          {canCloseWithoutSelection && onClose && (
            <button
              onClick={onClose}
              disabled={isLoading}
              title="Fechar (Esc)"
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-[#888888] hover:text-black dark:hover:text-white cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mensagem de Erro (se houver) */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* Corpo com Ações Principais e Lista de Recentes */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Cards de Ação Rápida */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Abrir Pasta do Computador */}
            {/* Sandbox Virtual (PRIMEIRO) */}
            <button
              onClick={handleOpenSandboxClick}
              disabled={isLoading}
              className="p-4 rounded-xl border border-[#e0e0e0] dark:border-[#2e2e2e] bg-neutral-50/60 dark:bg-[#252526] hover:border-amber-500/50 hover:shadow-md transition-all text-left flex flex-col justify-between group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Box className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Virtual
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-black dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Workspace Sandbox
                </h3>
                <p className="text-[11px] text-[#666666] dark:text-[#888888] mt-1">
                  Ambiente virtual isolado no navegador, persistido no IndexedDB e resistente a oscilações e falta de internet.
                </p>
              </div>
            </button>

            {/* Abrir Pasta Local (SEGUNDO) */}
            <button
              onClick={handleOpenFolderClick}
              disabled={isLoading || !isSupported}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                isSupported
                  ? 'border-[#007acc]/40 dark:border-[#007acc]/30 bg-blue-50/40 dark:bg-[#007acc]/10 hover:border-[#007acc] hover:shadow-md cursor-pointer'
                  : 'border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-[#007acc]/15 text-[#007acc] dark:text-[#3794ff] flex items-center justify-center">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#007acc]/10 text-[#007acc] dark:text-[#3794ff] border border-[#007acc]/20">
                  Disco Real
                </span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-black dark:text-white group-hover:text-[#007acc] dark:group-hover:text-[#3794ff] transition-colors">
                  Abrir Pasta do Computador...
                </h3>
                <p className="text-[11px] text-[#666666] dark:text-[#888888] mt-1">
                  {isSupported
                    ? 'Sincronize diretamente com um diretório do seu sistema operacional.'
                    : 'Requer Google Chrome, Microsoft Edge ou navegador Chromium.'}
                </p>
              </div>
            </button>
          </div>

          {/* Seção de Diretórios Recentes no Disco */}
          {isSupported && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#616161] dark:text-[#888888] flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Diretórios Recentes no Disco</span>
                </h3>
                <span className="text-[11px] text-[#888888]">
                  {recentWorkspaces.filter((w) => w.type === 'local').length} pastas
                </span>
              </div>

              <div className="border border-[#e5e5e5] dark:border-[#2a2a2a] rounded-xl overflow-hidden divide-y divide-[#e5e5e5] dark:divide-[#2a2a2a] bg-white dark:bg-[#181818]">
                {recentWorkspaces.filter((w) => w.type === 'local').length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#888888]">
                    Nenhum diretório recente ainda. Escolha uma das opções acima para começar!
                  </div>
                ) : (
                  recentWorkspaces
                    .filter((w) => w.type === 'local')
                    .map((workspace) => {
                      const isCurrent = workspace.id === currentWorkspaceId;

                      return (
                        <div
                          key={workspace.id}
                          onClick={() => handleSelectRecentItem(workspace)}
                          className={`px-4 py-3 flex items-center justify-between hover:bg-[#f0f0f0] dark:hover:bg-[#222222] transition-colors cursor-pointer group ${
                            isCurrent ? 'bg-[#007acc]/10 dark:bg-[#007acc]/15' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#007acc]/10 text-[#007acc] dark:text-[#3794ff]">
                              <FolderOpen className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-semibold text-black dark:text-white truncate">
                                  {workspace.name}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-0.5">
                                    <Check className="w-2.5 h-2.5" />
                                    <span>Ativo</span>
                                  </span>
                                )}
                                <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                  Disco
                                </span>
                              </div>
                              <p className="text-[11px] text-[#777777] dark:text-[#888888] truncate">
                                {workspace.path || 'Pasta no sistema operacional'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-[10px] text-[#999999] hidden sm:inline">
                              {formatRelativeTime(workspace.lastOpened)}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveRecent(workspace.id);
                              }}
                              title="Remover do histórico de recentes"
                              className="p-1.5 rounded text-[#888888] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors opacity-60 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3.5 border-t border-[#e5e5e5] dark:border-[#2a2a2a] bg-[#f8f8f8] dark:bg-[#181818] flex items-center justify-between text-xs">
          <label className="flex items-center space-x-2 cursor-pointer select-none text-[#555555] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white">
            <input
              type="checkbox"
              checked={alwaysOpenLast}
              onChange={handleToggleAlwaysOpenLast}
              className="rounded text-[#007acc] focus:ring-0 cursor-pointer"
            />
            <span>Sempre abrir o último projeto automaticamente</span>
          </label>

          {canCloseWithoutSelection && onClose ? (
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-md bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-black dark:text-white font-medium cursor-pointer transition-colors"
            >
              Continuar no Workspace Atual
            </button>
          ) : (
            <span className="text-[11px] text-[#888888]">Resistente a oscilações e falta de internet</span>
          )}
        </div>
      </div>
    </div>
  );
};
