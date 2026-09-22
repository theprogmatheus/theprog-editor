import React from 'react';
import { X, Keyboard, FolderTree, Terminal, WifiOff, Palette } from 'lucide-react';
import { APP_VERSION } from '../../config/version';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6">
      <div className="w-full max-w-2xl bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#3e3e42] rounded-xl shadow-2xl text-[#333333] dark:text-[#cccccc] overflow-hidden max-h-[90vh] flex flex-col transition-colors">
        {/* Cabeçalho */}
        <div className="h-12 px-5 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#333333] shrink-0 bg-[#fafafa] dark:bg-[#202021]">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-black dark:text-white">Recursos do TheProg Editor</h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#007acc]/10 dark:bg-[#3794ff]/15 text-[#007acc] dark:text-[#3794ff] border border-[#007acc]/25 dark:border-[#3794ff]/25 font-normal">
              v{APP_VERSION}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#ececec] dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo focado 100% no Editor */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* 1. Atalhos */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] rounded border border-[#e5e5e5] dark:border-[#333333] space-y-2">
            <div className="flex items-center space-x-1.5 font-semibold text-[#007acc] dark:text-[#3794ff]">
              <Keyboard className="w-4 h-4" />
              <span>1. Atalhos Principais do Teclado</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[#555555] dark:text-[#aaaaaa]">
              <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-[#252526] border border-[#e0e0e0] dark:border-[#333333]">
                <span>Executar / Compilar</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#333333] text-black dark:text-white font-mono text-[10px]">F5</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-[#252526] border border-[#e0e0e0] dark:border-[#333333]">
                <span>Salvar alterações</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#333333] text-black dark:text-white font-mono text-[10px]">Ctrl + S</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-[#252526] border border-[#e0e0e0] dark:border-[#333333]">
                <span>Localizar no código</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#333333] text-black dark:text-white font-mono text-[10px]">Ctrl + F</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-[#252526] border border-[#e0e0e0] dark:border-[#333333]">
                <span>Formatar código</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#333333] text-black dark:text-white font-mono text-[10px]">Shift + Alt + F</kbd>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-[#252526] border border-[#e0e0e0] dark:border-[#333333]">
                <span>Interromper programa</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#ececec] dark:bg-[#333333] text-black dark:text-white font-mono text-[10px]">Ctrl + C</kbd>
              </div>
            </div>
          </div>

          {/* 2. Explorador e Linguagens */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] rounded border border-[#e5e5e5] dark:border-[#333333] space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <FolderTree className="w-4 h-4" />
              <span>2. Gerenciador de Arquivos & Linguagens Suportadas</span>
            </div>
            <p className="text-[#666666] dark:text-[#aaaaaa] leading-relaxed">
              O editor cria, edita, executa e formata código em <strong>C</strong> (.c), <strong>C++</strong> (.cpp, .cc, .h),
              <strong> Python</strong> (.py), <strong>JavaScript</strong> (.js, .mjs), <strong>TypeScript</strong> (.ts) e
              <strong> Markdown</strong> (.md). Você pode criar novos arquivos ou pastas, renomeá-los ou excluí-los diretamente
              pelo explorador. A barra lateral pode ser <strong>redimensionada</strong> arrastando sua borda direita ou
              <strong> escondida</strong> no botão de colapsar.
            </p>
          </div>

          {/* 3. Console de Execução Autêntico */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] rounded border border-[#e5e5e5] dark:border-[#333333] space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-amber-600 dark:text-amber-400">
              <Terminal className="w-4 h-4" />
              <span>3. Consoles Nativos por Ambiente</span>
            </div>
            <p className="text-[#666666] dark:text-[#aaaaaa] leading-relaxed">
              O painel inferior possui duas abas: <strong>Ambiente</strong> (carregamento de runtimes, empacotamento e
              diagnósticos) e <strong>Execução</strong> (stdin/stdout do programa). Os runtimes rodam isolados em Web Workers:
              Clang/WASI para C e C++, <strong>Pyodide</strong> para Python e <strong>esbuild</strong> para JavaScript/TypeScript.
              Ao executar (F5), o foco vai direto para o console, permitindo digitar entradas de
              <code className="bg-[#e8e8e8] dark:bg-[#2d2d2d] px-1 py-0.5 rounded font-mono text-black dark:text-white">scanf()</code>,
              <code className="bg-[#e8e8e8] dark:bg-[#2d2d2d] px-1 py-0.5 rounded font-mono text-black dark:text-white">cin</code> e
              <code className="bg-[#e8e8e8] dark:bg-[#2d2d2d] px-1 py-0.5 rounded font-mono text-black dark:text-white">input()</code>.
            </p>
          </div>

          {/* 4. PWA Offline */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] rounded border border-[#e5e5e5] dark:border-[#333333] space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-sky-600 dark:text-sky-400">
              <WifiOff className="w-4 h-4" />
              <span>4. Offline Após o Primeiro Acesso (PWA & IndexedDB)</span>
            </div>
            <p className="text-[#666666] dark:text-[#aaaaaa] leading-relaxed">
              No primeiro acesso, os ambientes de execução são baixados e cacheados. Depois disso, o TheProg Editor opera
              offline: todos os arquivos, códigos e pacotes Python instalados ficam armazenados no seu computador ou no banco
              de dados local do navegador.
            </p>
          </div>

          {/* 5. Temas */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] rounded border border-[#e5e5e5] dark:border-[#333333] space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-purple-600 dark:text-purple-400">
              <Palette className="w-4 h-4" />
              <span>5. Temas Claro e Escuro</span>
            </div>
            <p className="text-[#666666] dark:text-[#aaaaaa] leading-relaxed">
              Alterne instantaneamente entre o tema Escuro e o tema Claro clicando no ícone de Sol/Lua no canto superior direito da barra de título.
            </p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="h-12 px-4 bg-[#f8f8f8] dark:bg-[#1e1e1e] border-t border-[#e5e5e5] dark:border-[#333333] flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#007acc] text-white font-medium hover:bg-[#0062a3] cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
