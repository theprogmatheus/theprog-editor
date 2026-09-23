import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GitBranch,
  GitCommit,
  Check,
  FileCode,
  RefreshCw,
  ChevronLeft,
  ChevronDown,
  Plus,
  Minus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { useDialog } from '../../context/DialogContext';
import {
  gitClient,
  type GitStatusResult,
  type GitCommitInfo,
  type GitBranchInfo,
} from '../../services/git/gitClient';

export const GitPanel: React.FC = () => {
  const {
    files,
    openDiffTab,
    updateFileContent,
    deleteFile,
    createNewFile,
    refreshGitStatus,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    sidebarWidth,
    setSidebarWidth,
  } = useEditor();

  const { showConfirm, showPrompt } = useDialog();

  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [history, setHistory] = useState<GitCommitInfo[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [committedFeedback, setCommittedFeedback] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isResizing, setIsResizing] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fechar dropdown de branch ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setIsBranchDropdownOpen(false);
      }
    };
    if (isBranchDropdownOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isBranchDropdownOpen]);

  // Manipulador de redimensionamento da sidebar via drag na borda direita
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX - 48;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setSidebarWidth]);

  const refreshState = useCallback(async () => {
    setIsSyncing(true);
    try {
      const initialized = await gitClient.isInitialized();
      if (!initialized) {
        setStatus({
          isInitialized: false,
          currentBranch: 'main',
          staged: [],
          unstaged: [],
          headCommitSha: undefined,
        });
        setBranches([]);
        setHistory([]);
        return;
      }
      const [currentStatus, branchList, commitLog] = await Promise.all([
        gitClient.getStatus(files),
        gitClient.listBranches(),
        gitClient.log(25),
      ]);
      setStatus(currentStatus);
      setBranches(branchList);
      setHistory(commitLog);
      await refreshGitStatus();
    } catch (err) {
      console.warn('Erro ao atualizar painel Git:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [files, refreshGitStatus]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleInit = async () => {
    setIsInitializing(true);
    try {
      await gitClient.init('main');
      await refreshState();
    } catch (err) {
      console.error('Falha ao inicializar Git:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStage = async (path: string) => {
    try {
      await gitClient.stage(path);
      await refreshState();
    } catch (err) {
      console.error('Falha ao preparar arquivo:', err);
    }
  };

  const handleStageAll = async () => {
    try {
      await gitClient.stageAll(files);
      await refreshState();
    } catch (err) {
      console.error('Falha ao preparar todos:', err);
    }
  };

  const handleUnstage = async (path: string) => {
    try {
      await gitClient.unstage(path);
      await refreshState();
    } catch (err) {
      console.error('Falha ao desmarcar arquivo:', err);
    }
  };

  const handleUnstageAll = async () => {
    try {
      await gitClient.unstageAll();
      await refreshState();
    } catch (err) {
      console.error('Falha ao desmarcar todos:', err);
    }
  };

  const handleDiscard = async (filepath: string) => {
    const confirmed = await showConfirm({
      title: 'Descartar alterações?',
      message: `Tem certeza que deseja reverter as modificações de "${filepath}" para o estado do último commit? Esta ação é irreversível.`,
      confirmText: 'Descartar Alterações',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (!confirmed) return;

    try {
      const restoredContent = await gitClient.discard(filepath);
      const target = files.find(
        (f) => f.path === filepath || f.path === `/${filepath.replace(/^\//, '')}`
      );
      if (restoredContent !== null) {
        if (target) {
          await updateFileContent(target.id, restoredContent);
        } else {
          const name = filepath.split('/').pop() || 'file';
          await createNewFile(name, false, null, restoredContent);
        }
      } else if (target) {
        await deleteFile(target.id);
      }
      await refreshState();
    } catch (err) {
      console.error('Falha ao descartar alterações:', err);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || isCommitting || !status?.staged.length) return;
    setIsCommitting(true);
    try {
      await gitClient.commit(files, commitMessage.trim());
      setCommitMessage('');
      setCommittedFeedback(true);
      setTimeout(() => setCommittedFeedback(false), 2000);
      await refreshState();
    } catch (err) {
      console.error('Erro ao realizar commit:', err);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleSwitchBranch = async (branchName: string) => {
    try {
      const changedFiles = await gitClient.checkout(branchName);
      for (const item of changedFiles) {
        const existing = files.find(
          (f) => f.path === item.path || f.path === `/${item.path.replace(/^\//, '')}`
        );
        if (existing) {
          await updateFileContent(existing.id, item.content);
        } else {
          const name = item.path.split('/').pop() || 'file';
          await createNewFile(name, false, null, item.content);
        }
      }
      setIsBranchDropdownOpen(false);
      await refreshState();
    } catch (err: any) {
      alert(err?.message || 'Falha ao trocar de branch');
    }
  };

  const handleCreateBranch = async () => {
    const branchName = await showPrompt({
      title: 'Criar Nova Branch',
      message: 'Digite o nome da nova branch:',
      placeholder: 'ex: feature/minha-mudanca',
      confirmText: 'Criar e Trocar',
      cancelText: 'Cancelar',
    });
    if (branchName && branchName.trim()) {
      try {
        await gitClient.createBranch(branchName.trim());
        await handleSwitchBranch(branchName.trim());
      } catch (err: any) {
        alert(err?.message || 'Falha ao criar branch');
      }
    }
  };

  if (!isSidebarOpen) return null;

  return (
    <>
      {/* Backdrop para dispositivos móveis */}
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        style={{ width: isMobile ? '280px' : `${sidebarWidth}px` }}
        className="fixed inset-y-0 left-12 z-40 md:relative md:inset-auto md:z-auto flex flex-col bg-[#f3f3f3] dark:bg-[#181818] border-r border-[#e5e5e5] dark:border-[#252526] select-none text-[#333333] dark:text-[#cccccc] text-xs h-full shrink-0 shadow-2xl md:shadow-none transition-[background-color,border-color] duration-150 max-w-[calc(100vw-3rem)]"
      >
        {/* Topo do Painel Git com botões globais */}
        <div className="h-9 px-3 flex items-center justify-between font-semibold tracking-wider text-[11px] text-[#616161] dark:text-[#888888] border-b border-[#e5e5e5] dark:border-[#202020] shrink-0">
          <div className="flex items-center space-x-1.5 truncate mr-1">
            <span className="truncate">CONTROLE DE VERSÃO</span>
            <span className="text-[9px] px-1 py-0.2 rounded font-mono font-normal bg-neutral-200 dark:bg-[#2a2a2a] text-neutral-600 dark:text-neutral-400">
              GIT
            </span>
          </div>
          <div className="flex items-center space-x-0.5 shrink-0">
            <button
              onClick={refreshState}
              title="Atualizar Status do Git"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#007acc]' : ''}`} />
            </button>
            <button
              onClick={toggleSidebar}
              title="Esconder Barra Lateral"
              className="p-1 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#37373d] text-[#616161] dark:text-[#aaaaaa] hover:text-black dark:hover:text-white cursor-pointer ml-0.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {status && !status.isInitialized ? (
            /* Estado Inicial: Não Inicializado */
            <div className="p-3 flex flex-col items-center justify-center text-center space-y-3.5 my-auto">
              <div className="w-12 h-12 rounded-full bg-[#007acc]/10 dark:bg-[#007acc]/20 flex items-center justify-center text-[#007acc] dark:text-[#3794ff]">
                <GitBranch className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-black dark:text-white">
                  Repositório Não Inicializado
                </h3>
                <p className="text-xs text-[#777777] dark:text-[#999999] leading-relaxed">
                  Inicialize o Git para rastrear alterações, criar branches, comparar diffs e fazer commits offline no navegador.
                </p>
              </div>

              <div className="p-2.5 rounded bg-blue-50 dark:bg-[#1a2333] border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-800 dark:text-blue-300 text-left space-y-1 w-full">
                <div className="flex items-center space-x-1 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-[#007acc] shrink-0" />
                  <span>100% Client-Side & Offline</span>
                </div>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80 leading-normal">
                  Os dados do Git são persistidos no IndexedDB local do seu navegador. Nenhum arquivo é transferido para servidores externos.
                </p>
              </div>

              <button
                onClick={handleInit}
                disabled={isInitializing}
                className="w-full py-2 px-3 rounded bg-[#007acc] hover:bg-[#0062a3] text-white font-medium text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
              >
                {isInitializing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Inicializando...</span>
                  </>
                ) : (
                  <>
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Inicializar Repositório Git (git init)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Estado Inicializado: Branch Switcher, Commits, Staged, Unstaged e Histórico */
            <>
              {/* Seletor de Branch */}
              <div className="relative" ref={branchDropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBranchDropdownOpen(!isBranchDropdownOpen);
                  }}
                  className="w-full px-2.5 py-1.5 rounded flex items-center justify-between bg-white dark:bg-[#252526] hover:bg-[#f0f0f0] dark:hover:bg-[#2c2c2d] border border-[#d0d0d0] dark:border-[#383838] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <GitBranch className="w-3.5 h-3.5 text-[#007acc] dark:text-[#3794ff] shrink-0" />
                    <span className="font-mono text-xs font-semibold text-black dark:text-white truncate">
                      {status?.currentBranch || 'main'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#888888] shrink-0 ml-1" />
                </button>

                {isBranchDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-[#202021] border border-[#d0d0d0] dark:border-[#3a3a3a] rounded-md shadow-xl py-1 text-xs">
                    <div className="px-2.5 py-1 text-[10px] font-semibold text-[#888888] uppercase tracking-wider">
                      Branches Locais
                    </div>
                    {branches.map((b) => (
                      <button
                        key={b.name}
                        onClick={() => handleSwitchBranch(b.name)}
                        className={`w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors ${
                          b.isCurrent
                            ? 'font-bold text-[#007acc] dark:text-[#3794ff]'
                            : 'text-black dark:text-white'
                        }`}
                      >
                        <span className="truncate">{b.name}</span>
                        {b.isCurrent && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                      </button>
                    ))}
                    <div className="border-t border-[#e5e5e5] dark:border-[#333333] my-1" />
                    <button
                      onClick={() => {
                        setIsBranchDropdownOpen(false);
                        handleCreateBranch();
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center space-x-1.5 text-left text-[#007acc] dark:text-[#3794ff] hover:bg-[#007acc] hover:text-white cursor-pointer transition-colors font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Criar Nova Branch...</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mensagem e Ação de Commit */}
              <div className="space-y-1.5">
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Mensagem do commit (Ctrl+Enter para gravar)..."
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      handleCommit();
                    }
                  }}
                  rows={2}
                  className="w-full p-2 rounded text-xs border border-[#cccccc] dark:border-[#383838] bg-white dark:bg-[#252526] text-black dark:text-white focus:outline-none focus:border-[#007acc] resize-none"
                />
                <button
                  onClick={handleCommit}
                  disabled={!commitMessage.trim() || isCommitting || !status?.staged.length}
                  title={
                    !status?.staged.length
                      ? 'Nenhuma alteração preparada para commit. Clique no "+" ao lado dos arquivos para prepará-los.'
                      : !commitMessage.trim()
                      ? 'Digite uma mensagem de commit.'
                      : 'Gravar commit (Ctrl+Enter)'
                  }
                  className={`w-full py-1.5 px-3 rounded flex items-center justify-center space-x-1.5 font-semibold text-xs text-white shadow-xs transition-colors cursor-pointer ${
                    !commitMessage.trim() || isCommitting || !status?.staged.length
                      ? 'bg-neutral-400 dark:bg-neutral-600 opacity-60 cursor-not-allowed'
                      : 'bg-[#007acc] hover:bg-[#0062a3]'
                  }`}
                >
                  {committedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Commit Realizado com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <GitCommit className="w-3.5 h-3.5" />
                      <span>{isCommitting ? 'Gravando Commit...' : 'Commit'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Alterações Preparadas (Staged) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#666666] dark:text-[#888888] uppercase tracking-wider py-1 px-1">
                  <div className="flex items-center space-x-1.5">
                    <span>Alterações Preparadas</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-[#2a2a2a] text-neutral-700 dark:text-neutral-300">
                      {status?.staged.length || 0}
                    </span>
                  </div>
                  {status && status.staged.length > 0 && (
                    <button
                      onClick={handleUnstageAll}
                      title="Desmarcar todas as alterações preparadas"
                      className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {status?.staged.map((item) => (
                  <div
                    key={`staged-${item.path}`}
                    onClick={() => openDiffTab(item.path)}
                    title={`Clique para comparar diff: ${item.path}`}
                    className="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#252526] cursor-pointer transition-colors text-xs border border-transparent hover:border-[#e0e0e0] dark:hover:border-[#383838]"
                  >
                    <div className="flex items-center space-x-2 truncate flex-1 mr-1">
                      <FileCode className="w-3.5 h-3.5 text-[#007acc] shrink-0" />
                      <span className="truncate font-mono text-[11px] text-black dark:text-white">
                        {item.path.replace(/^\//, '')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <span
                        className={`font-mono text-[10px] font-bold px-1 rounded ${
                          item.status === 'modified'
                            ? 'text-amber-500'
                            : item.status === 'added'
                            ? 'text-emerald-500'
                            : 'text-rose-500'
                        }`}
                      >
                        {item.status === 'modified' ? 'M' : item.status === 'added' ? 'A' : 'D'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnstage(item.path);
                        }}
                        title="Desmarcar alteração (unstage)"
                        className="p-1 rounded hover:bg-[#d8d8d8] dark:hover:bg-[#3a3a3a] text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Alterações Pendentes (Unstaged) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#666666] dark:text-[#888888] uppercase tracking-wider py-1 px-1">
                  <div className="flex items-center space-x-1.5">
                    <span>Alterações</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-[#2a2a2a] text-neutral-700 dark:text-neutral-300">
                      {status?.unstaged.length || 0}
                    </span>
                  </div>
                  {status && status.unstaged.length > 0 && (
                    <button
                      onClick={handleStageAll}
                      title="Preparar todas as alterações"
                      className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {status && status.unstaged.length === 0 && !status.staged.length && (
                  <div className="p-3 text-center text-[#888888] bg-[#f9f9f9] dark:bg-[#1e1e1e] rounded-lg border border-dashed border-[#e0e0e0] dark:border-[#333333] text-[11px]">
                    Nenhuma alteração pendente no repositório.
                  </div>
                )}

                {status?.unstaged.map((item) => (
                  <div
                    key={`unstaged-${item.path}`}
                    onClick={() => openDiffTab(item.path)}
                    title={`Clique para comparar diff: ${item.path}`}
                    className="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#e8e8e8] dark:hover:bg-[#252526] cursor-pointer transition-colors text-xs border border-transparent hover:border-[#e0e0e0] dark:hover:border-[#383838]"
                  >
                    <div className="flex items-center space-x-2 truncate flex-1 mr-1">
                      <FileCode className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span className="truncate font-mono text-[11px] text-black dark:text-white">
                        {item.path.replace(/^\//, '')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <span
                        className={`font-mono text-[10px] font-bold px-1 rounded ${
                          item.status === 'modified'
                            ? 'text-amber-500'
                            : item.stage === 'untracked' || item.status === 'added'
                            ? 'text-emerald-500'
                            : 'text-rose-500'
                        }`}
                      >
                        {item.status === 'modified'
                          ? 'M'
                          : item.stage === 'untracked'
                          ? 'U'
                          : item.status === 'added'
                          ? 'A'
                          : 'D'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDiscard(item.path);
                        }}
                        title="Descartar alterações (reverter para commit)"
                        className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-neutral-600 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStage(item.path);
                        }}
                        title="Preparar alterações (stage)"
                        className="p-1 rounded hover:bg-[#d8d8d8] dark:hover:bg-[#3a3a3a] text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Histórico de Commits Recentes */}
              {history.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-[#e5e5e5] dark:border-[#282828]">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#666666] dark:text-[#888888] uppercase tracking-wider py-1 px-1">
                    <span>Histórico de Commits</span>
                    <span className="font-mono text-[10px]">{history.length}</span>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                    {history.map((c) => (
                      <div
                        key={c.oid}
                        className="p-2 rounded border border-[#e5e5e5] dark:border-[#2f2f30] bg-[#fafafa] dark:bg-[#1f1f20] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="font-medium text-black dark:text-white text-[11px] truncate flex-1"
                            title={c.message}
                          >
                            {c.message}
                          </span>
                          <span className="font-mono text-[10px] text-[#007acc] dark:text-[#3794ff] px-1 py-0.2 rounded bg-[#007acc]/10 dark:bg-[#3794ff]/10 shrink-0">
                            {c.oid.slice(0, 7)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#888888]">
                          <span className="truncate max-w-[120px]">{c.author.name}</span>
                          <span>
                            {new Date(c.timestamp).toLocaleDateString([], {
                              day: '2-digit',
                              month: '2-digit',
                            })}{' '}
                            {new Date(c.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Alça de redimensionamento na borda direita */}
        <div
          onMouseDown={() => setIsResizing(true)}
          title="Arraste para redimensionar o painel Git"
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[#007acc]/60 transition-colors z-10"
        />
      </aside>
    </>
  );
};
export default GitPanel;
