import React from 'react';
import { Terminal, Cpu } from 'lucide-react';

interface LinuxLoadingScreenProps {
  isLoading: boolean;
  statusMessage?: string;
}

export const LinuxLoadingScreen: React.FC<LinuxLoadingScreenProps> = ({ isLoading, statusMessage }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1e1e1e] dark:bg-[#121212] text-[#cccccc] select-none transition-opacity duration-300">
      <div className="flex flex-col items-center max-w-sm px-6 text-center">
        {/* Ícone com pulso */}
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-xl bg-[#007acc]/20 border border-[#007acc]/40 flex items-center justify-center text-[#3794ff]">
            <Terminal className="w-8 h-8 animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#1e1e1e] border border-[#333333]">
            <Cpu className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Título */}
        <h2 className="text-base font-semibold text-white mb-1.5 tracking-wide">
          Iniciando TheProg Editor
        </h2>

        {/* Mensagem de status */}
        <p className="text-xs text-[#888888] mb-6">
          {statusMessage || 'Inicializando kernel Linux e compilador GCC...'}
        </p>

        {/* Barra de progresso indeterminada */}
        <div className="w-48 h-1 bg-[#2d2d2d] rounded-full overflow-hidden">
          <div className="h-full bg-[#007acc] rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
        </div>

        <span className="text-[10px] text-[#555555] mt-4 font-mono">
          Ambiente WebAssembly 100% Offline
        </span>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); width: 30%; }
          50% { transform: translateX(50%); width: 60%; }
          100% { transform: translateX(200%); width: 30%; }
        }
      `}</style>
    </div>
  );
};
