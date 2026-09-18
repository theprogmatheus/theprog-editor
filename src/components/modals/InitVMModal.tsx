import React, { useState } from 'react';
import { X, Server, CheckCircle2, Cpu, HardDrive, Play, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { vmManager } from '../../services/vmManager';
import { useEditor } from '../../context/EditorContext';

interface InitVMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InitVMModal: React.FC<InitVMModalProps> = ({ isOpen, onClose }) => {
  const {
    vmStatus,
    vmStatusMessage,
    compilerProgress,
    preloadCompiler,
    isSystemReady,
    systemStatus,
    systemProgressPercent,
  } = useEditor();
  const [customUrl, setCustomUrl] = useState('');
  const [isBooting, setIsBooting] = useState(false);

  if (!isOpen) return null;

  const isCoiActive = typeof window !== 'undefined' && Boolean(window.crossOriginIsolated);

  const handleStartV86 = async () => {
    setIsBooting(true);
    await vmManager.initV86(customUrl.trim() || undefined);
    setIsBooting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#3e3e42] rounded-lg shadow-2xl text-[#333333] dark:text-[#cccccc] overflow-hidden transition-colors max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="h-11 px-4 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#333333] shrink-0">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-black dark:text-white">Informações do Sistema</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#ececec] dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Card Resumo do Sistema */}
          <div className="p-3 bg-[#f3f4f6] dark:bg-[#1c1c1c] border border-[#e5e5e5] dark:border-[#333333] rounded-md">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-black dark:text-white">Status Geral do Sistema</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center space-x-1 ${
                  isSystemReady
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : systemStatus === 'error'
                    ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                    : 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800 animate-pulse'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSystemReady ? 'bg-emerald-500' : systemStatus === 'error' ? 'bg-rose-500' : 'bg-blue-500'
                  }`}
                />
                <span>{isSystemReady ? '100% Pronto para Execução' : `Carregando (${systemProgressPercent}%)`}</span>
              </span>
            </div>

            {/* Barra de progresso do sistema */}
            {!isSystemReady && (
              <div className="w-full bg-[#e5e5e5] dark:bg-[#2d2d2d] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, systemProgressPercent)}%` }}
                />
              </div>
            )}
            <p className="text-[11px] text-[#666666] dark:text-[#888888] mt-1.5">
              O botão de execução fica desativado até que todos os módulos do Clang e do ambiente Linux estejam 100% carregados na memória.
            </p>
          </div>

          {/* Card 1: Compilador Clang WebAssembly (C/C++) */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-black dark:text-white">1. Compilador Clang C/C++ (LLVM WebAssembly)</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] border ${
                  compilerProgress.status === 'ready'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50'
                    : compilerProgress.status === 'preloading'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700/50'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                }`}
              >
                {compilerProgress.status === 'ready'
                  ? 'Pronto na memória (100%)'
                  : compilerProgress.status === 'preloading'
                  ? `Pré-carregando (${compilerProgress.percent}%)`
                  : 'Aguardando'}
              </span>
            </div>
            <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
              O compilador Clang LLVM é carregado diretamente no navegador via WebAssembly com cabeçalhos padrão C/C++ para compilação instantânea e offline.
            </p>
            {compilerProgress.status === 'error' && (
              <button
                onClick={() => preloadCompiler()}
                className="flex items-center space-x-1 text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Tentar reconectar Clang</span>
              </button>
            )}
          </div>

          {/* Card 2: Ambiente Linux & Kernel Emulado (v86) */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-black dark:text-white">2. Ambiente Linux & Runtime (v86 / WASI)</span>
              <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                {vmStatusMessage || vmStatus}
              </span>
            </div>
            <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
              Emulador x86 de baixo nível e runtime POSIX WASI com isolamento total em Web Worker, impedindo que loops infinitos congelem a aba.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2 bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#333333] rounded space-y-0.5">
                <div className="flex items-center space-x-1 font-medium text-black dark:text-white text-[11px]">
                  <Cpu className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  <span>Processador</span>
                </div>
                <p className="text-[11px] text-[#666666] dark:text-[#888888]">x86 32-bit (Wasm JIT)</p>
              </div>

              <div className="p-2 bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#333333] rounded space-y-0.5">
                <div className="flex items-center space-x-1 font-medium text-black dark:text-white text-[11px]">
                  <HardDrive className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span>Memória RAM</span>
                </div>
                <p className="text-[11px] text-[#666666] dark:text-[#888888]">256 MB (Wasm)</p>
              </div>
            </div>
          </div>

          {/* Card 3: Entrada Interativa no Terminal (scanf / cin) */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-black dark:text-white">3. Entrada Interativa no Terminal (scanf / cin)</span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] border flex items-center space-x-1 ${
                  isCoiActive
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50'
                }`}
              >
                {isCoiActive ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Disponível em Tempo Real</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span>Requer Acesso Oficial</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
              {isCoiActive
                ? 'Seu navegador está operando com suporte completo a execução interativa. Entradas de dados em chamadas como scanf() e cin são capturadas diretamente no terminal em tempo real.'
                : 'Para digitar entradas interativas em tempo real durante a execução do código, acesse o TheProg Editor através do endereço oficial com aceleração ou instale como aplicativo (PWA).'}
            </p>
            {!isCoiActive && (
              <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-center justify-between">
                <span>Endereço oficial: <strong>https://matheus.eti.br/theprog-editor</strong></span>
                <a
                  href="https://matheus.eti.br/theprog-editor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-[#007acc] text-white rounded hover:bg-[#0062a3] text-[11px] font-medium"
                >
                  Acessar
                </a>
              </div>
            )}
          </div>

          {/* Imagem Alpine Opcional */}
          <div>
            <label className="block font-medium text-black dark:text-white mb-1">
              Imagem do Alpine Linux / ISO Customizada (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ex: https://copy.sh/v86/build/alpine.iso ou deixe vazio para modo integrado"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="w-full bg-white dark:bg-[#1e1e1e] border border-[#cccccc] dark:border-[#3e3e42] rounded px-3 py-1.5 text-black dark:text-white outline-none focus:border-[#007acc]"
            />
          </div>
        </div>

        {/* Rodapé */}
        <div className="h-12 px-4 bg-[#f8f8f8] dark:bg-[#1e1e1e] border-t border-[#e5e5e5] dark:border-[#333333] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sistema WebAssembly 100% Offline</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded hover:bg-[#ececec] dark:hover:bg-[#333333] text-[#555555] dark:text-[#cccccc] cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handleStartV86}
              disabled={isBooting}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#007acc] hover:bg-[#0062a3] text-white font-medium cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isBooting ? 'Inicializando...' : 'Iniciar / Reiniciar VM'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
