import React from 'react';
import { Terminal, Cpu } from 'lucide-react';

interface LinuxLoadingScreenProps {
  isLoading: boolean;
  progressPercent?: number;
  statusMessage?: string;
  isError?: boolean;
}

export const LinuxLoadingScreen: React.FC<LinuxLoadingScreenProps> = ({
  isLoading,
  progressPercent = 0,
  statusMessage,
  isError = false,
}) => {
  if (!isLoading) return null;

  const percent = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#181818] text-[#cccccc] select-none transition-opacity duration-300">
      <div className="flex flex-col items-center max-w-md px-6 text-center">
        {/* Ícone com pulso */}
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#007acc]/15 border border-[#007acc]/30 flex items-center justify-center text-[#3794ff] shadow-lg shadow-[#007acc]/10">
            <Terminal className="w-8 h-8 animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#181818] border border-[#333333]">
            <Cpu
              className={`w-4 h-4 ${isError ? 'text-rose-500' : 'text-emerald-400 animate-spin'}`}
              style={{ animationDuration: '3s' }}
            />
          </div>
        </div>

        {/* Título */}
        <h2 className="text-lg font-bold text-white mb-1 tracking-wide">
          TheProg Editor
        </h2>

        {/* Mensagem de status */}
        <p className="text-xs text-[#999999] mb-5 min-h-[1.25rem]">
          {statusMessage || 'Inicializando compilador Clang e ambiente de execução...'}
        </p>

        {isError ? (
          <div className="space-y-3">
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
              Falha ao carregar o compilador. Verifique sua conexão e tente novamente.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 rounded bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-medium cursor-pointer transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        ) : (
          <div className="w-64 sm:w-72 space-y-2">
            {/* Barra de progresso com porcentagem */}
            <div className="w-full h-2 bg-[#282828] rounded-full overflow-hidden border border-[#383838]">
              <div
                className="h-full bg-linear-to-r from-[#007acc] to-[#3794ff] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, percent)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#777777] font-mono px-0.5">
              <span>Carregando Sistema</span>
              <span className="text-[#3794ff] font-semibold">{percent}%</span>
            </div>
          </div>
        )}

        <span className="text-[10px] text-[#555555] mt-8 font-mono">
          Compilação C/C++ Real em WebAssembly • Resistente a oscilações e falta de internet
        </span>
      </div>
    </div>
  );
};
