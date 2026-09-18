import React, { useState } from 'react';
import { X, Server, CheckCircle2, Cpu, HardDrive, Play } from 'lucide-react';
import { vmManager } from '../../services/vmManager';
import { useEditor } from '../../context/EditorContext';

interface InitVMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InitVMModal: React.FC<InitVMModalProps> = ({ isOpen, onClose }) => {
  const { vmStatus, vmStatusMessage, compilerProgress } = useEditor();
  const [customUrl, setCustomUrl] = useState('');
  const [isBooting, setIsBooting] = useState(false);

  if (!isOpen) return null;

  const handleStartV86 = async () => {
    setIsBooting(true);
    await vmManager.initV86(customUrl.trim() || undefined);
    setIsBooting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#3e3e42] rounded-lg shadow-2xl text-[#333333] dark:text-[#cccccc] overflow-hidden transition-colors">
        {/* Cabeçalho */}
        <div className="h-11 px-4 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#333333]">
          <div className="flex items-center space-x-2">
            <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-black dark:text-white">Ambiente de Execução e VM</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#ececec] dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 space-y-4 text-xs">
          {/* Card Modo Integrado (Clang Wasm) */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-black dark:text-white">Compilador Clang WebAssembly (Padrão)</span>
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
                  ? 'Pronto na memória'
                  : compilerProgress.status === 'preloading'
                  ? `Pré-carregando (${compilerProgress.percent}%)`
                  : 'Aguardando inicialização'}
              </span>
            </div>
            <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
              O TheProg Editor pré-carrega o LLVM/Clang em segundo plano com headers padrão C/C++ (glibc/libc++) para compilação local ultrarrápida (milissegundos) e 100% offline.
            </p>
          </div>

          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-black dark:text-white">Máquina Virtual Linux (v86)</span>
              <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                {vmStatusMessage || vmStatus}
              </span>
            </div>
            <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
              Emulador x86 de baixo nível para executar um ambiente de terminal Linux completo dentro da aba do navegador.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded space-y-1">
              <div className="flex items-center space-x-1.5 font-medium text-black dark:text-white">
                <Cpu className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Processador Emulado</span>
              </div>
              <p className="text-[#666666] dark:text-[#888888]">x86 32-bit (v86 Wasm JIT)</p>
            </div>

            <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded space-y-1">
              <div className="flex items-center space-x-1.5 font-medium text-black dark:text-white">
                <HardDrive className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Memória RAM</span>
              </div>
              <p className="text-[#666666] dark:text-[#888888]">256 MB (Wasm)</p>
            </div>
          </div>

          <div>
            <label className="block font-medium text-black dark:text-white mb-1.5">
              Imagem do Alpine Linux / ISO Customizada (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ex: https://copy.sh/v86/build/alpine.iso ou deixe vazio para modo integrado"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="w-full bg-white dark:bg-[#1e1e1e] border border-[#cccccc] dark:border-[#3e3e42] rounded px-3 py-1.5 text-black dark:text-white outline-none focus:border-[#007acc]"
            />
            <p className="text-[10px] text-[#777777] mt-1">
              Se deixado em branco, o editor opera no <strong>Modo Integrado</strong> com compilação e terminal instantâneos.
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="h-12 px-4 bg-[#f8f8f8] dark:bg-[#1e1e1e] border-t border-[#e5e5e5] dark:border-[#333333] flex items-center justify-between">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Bios & Wasm prontos offline</span>
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
