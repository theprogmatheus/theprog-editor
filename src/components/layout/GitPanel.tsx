import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch,
  GitCommit,
  Check,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import { gitClient, type GitFileStatus, type GitCommitInfo } from '../../services/git/gitClient';

export const GitPanel: React.FC = () => {
  const { files, openFile } = useEditor();
  const [statuses, setStatuses] = useState<GitFileStatus[]>([]);
  const [history, setHistory] = useState<GitCommitInfo[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [committedFeedback, setCommittedFeedback] = useState(false);

  const refreshGitState = useCallback(async () => {
    setIsSyncing(true);
    try {
      const currentStatuses = await gitClient.syncWorkspace(files);
      setStatuses(currentStatuses.filter((s) => s.status !== 'unmodified'));
      const commitLog = await gitClient.log();
      setHistory(commitLog);
    } catch (err) {
      console.warn('Erro ao atualizar estado do Git:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [files]);

  useEffect(() => {
    refreshGitState();
  }, [refreshGitState]);

  const handleCommit = async () => {
    if (!commitMessage.trim() || isCommitting) return;
    setIsCommitting(true);
    try {
      await gitClient.commit(files, commitMessage.trim());
      setCommitMessage('');
      setCommittedFeedback(true);
      setTimeout(() => setCommittedFeedback(false), 2000);
      await refreshGitState();
    } catch (err) {
      console.warn('Erro ao criar commit:', err);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#181818] text-[#333333] dark:text-[#cccccc] text-xs select-none">
      {/* Cabeçalho do Painel */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#252526] bg-[#f3f3f3] dark:bg-[#1f1f1f] shrink-0 font-semibold">
        <div className="flex items-center space-x-2">
          <GitBranch className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
          <span>Controle de Versão (Git Local)</span>
        </div>
        <button
          onClick={refreshGitState}
          title="Atualizar Status do Git"
          className="p-1 rounded hover:bg-[#e0e0e0] dark:hover:bg-[#2d2d2d] cursor-pointer text-[#777777] hover:text-black dark:hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Formulário de Commit */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-black dark:text-white">
            Mensagem do Commit
          </label>
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Descreva as alterações feitas..."
            rows={2}
            className="w-full p-2 rounded text-xs border border-[#cccccc] dark:border-[#383838] bg-white dark:bg-[#252526] text-black dark:text-white focus:outline-none focus:border-[#007acc] resize-none"
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || isCommitting}
            className={`w-full py-1.5 px-3 rounded flex items-center justify-center space-x-1.5 font-semibold text-xs text-white shadow-xs transition-colors cursor-pointer ${
              !commitMessage.trim() || isCommitting
                ? 'bg-neutral-400 dark:bg-neutral-600 opacity-60 cursor-not-allowed'
                : 'bg-[#007acc] hover:bg-[#0062a3]'
            }`}
          >
            {committedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Commit Realizado!</span>
              </>
            ) : (
              <>
                <GitCommit className="w-3.5 h-3.5" />
                <span>{isCommitting ? 'Gravando...' : 'Fazer Commit das Alterações'}</span>
              </>
            )}
          </button>
        </div>

        {/* Alterações Atuais (Staged / Working Tree) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#666666] dark:text-[#888888] uppercase tracking-wider">
            <span>Arquivos Modificados</span>
            <span className="font-mono text-[10px]">{statuses.length}</span>
          </div>

          {statuses.length === 0 ? (
            <div className="p-3 text-center text-[#888888] bg-[#f9f9f9] dark:bg-[#1e1e1e] rounded-lg border border-dashed border-[#e0e0e0] dark:border-[#333333]">
              Nenhuma alteração pendente no repositório.
            </div>
          ) : (
            <div className="space-y-1">
              {statuses.map((s) => {
                const targetFile = files.find((f) => f.path === s.path);
                return (
                  <div
                    key={s.path}
                    onClick={() => targetFile && openFile(targetFile.id)}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-[#f0f0f0] dark:hover:bg-[#252526] cursor-pointer transition-colors border border-transparent hover:border-[#e0e0e0] dark:hover:border-[#383838]"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-[#007acc] shrink-0" />
                      <span className="truncate text-black dark:text-white font-mono text-[11px]">
                        {s.path}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        s.status === 'modified'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : s.status === 'added'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {s.status === 'modified' ? 'M' : s.status === 'added' ? 'A' : 'D'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Histórico de Commits Recentes */}
        <div className="space-y-2 pt-2 border-t border-[#e5e5e5] dark:border-[#282828]">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#666666] dark:text-[#888888] uppercase tracking-wider">
            <span>Histórico de Commits</span>
            <span className="font-mono text-[10px]">{history.length}</span>
          </div>

          {history.length === 0 ? (
            <div className="p-3 text-center text-[#888888] bg-[#f9f9f9] dark:bg-[#1e1e1e] rounded-lg border border-dashed border-[#e0e0e0] dark:border-[#333333]">
              Nenhum commit realizado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((c) => (
                <div
                  key={c.oid}
                  className="p-2.5 rounded-lg border border-[#e5e5e5] dark:border-[#333333] bg-[#fafafa] dark:bg-[#202021] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-black dark:text-white truncate">
                      {c.message}
                    </span>
                    <span className="font-mono text-[10px] text-[#007acc] dark:text-[#3794ff] px-1.5 py-0.5 rounded bg-[#007acc]/10 dark:bg-[#3794ff]/10">
                      {c.oid.slice(0, 7)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#888888]">
                    <span>{c.author.name}</span>
                    <span>{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
