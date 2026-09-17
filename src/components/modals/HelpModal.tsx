import React from 'react';
import { X, Keyboard, FolderTree, Terminal, WifiOff, Palette } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#3e3e42] rounded-lg shadow-2xl text-[#333333] dark:text-[#cccccc] overflow-hidden max-h-[85vh] flex flex-col transition-colors">
        {/* Cabeçalho */}
        <div className="h-11 px-4 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#333333] shrink-0">
          <h2 className="text-sm font-semibold text-black dark:text-white">Recursos do TheProg Editor</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#ececec] dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo focado 100% no Editor */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. Atalhos */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] rounded border border-[#e5e5e5] dark:border-[#333333] space-y-2">
            <div className="flex items-center space-x-1.5 font-semibold text-[#007acc] dark:text-[#3794ff]">
              <Keyboard className="w-4 h-4" />
              <span>1. Atalhos Principais do Teclado</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[#555555] dark:text-[#aaaaaa]">
              <div className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-[#252526] border border-[#e0e0e0] dark:border-[#333333]">
                <span>Executar arquivo</span>
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
              <span>2. Gerenciador de Arquivos & Múltiplas Linguagens</span>
            </div>
            <p className="text-[#666666] dark:text-[#aaaaaa] leading-relaxed">
              O editor é compatível com qualquer extensão de arquivo (C, C++, Python, JavaScript, TypeScript, Shell, HTML, CSS, JSON, Markdown, etc.).
              Você pode criar novos arquivos ou pastas, renomeá-los ou excluí-los diretamente pelo explorador.
              A barra lateral pode ser <strong>redimensionada</strong> arrastando sua borda direita ou <strong>escondida</strong> no botão de colapsar.
            </p>
          </div>

          {/* 3. Terminal Integrado */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] rounded border border-[#e5e5e5] dark:border-[#333333] space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-amber-600 dark:text-amber-400">
              <Terminal className="w-4 h-4" />
              <span>3. Terminal Integrado Linux</span>
            </div>
            <p className="text-[#666666] dark:text-[#aaaaaa] leading-relaxed">
              O painel inferior conta com um terminal padrão Linux (prompt <code className="bg-[#e8e8e8] dark:bg-[#2d2d2d] px-1 py-0.5 rounded font-mono text-black dark:text-white">theprog-editor:~$</code>).
              Suporta navegação no <strong>histórico de comandos</strong> (setas Cima / Baixo), <strong>autocompletion inteligente</strong> de comandos e arquivos (tecla Tab), edição com setas Esquerda/Direita e blindagem de output.
              Ao pressionar <strong>Executar (F5)</strong>, o terminal é exibido automaticamente com a execução limpa do seu código.
            </p>
          </div>

          {/* 4. PWA Offline */}
          <div className="p-3 bg-[#f8f8f8] dark:bg-[#1e1e1e] rounded border border-[#e5e5e5] dark:border-[#333333] space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-sky-600 dark:text-sky-400">
              <WifiOff className="w-4 h-4" />
              <span>4. Modo 100% Offline (PWA & IndexedDB)</span>
            </div>
            <p className="text-[#666666] dark:text-[#aaaaaa] leading-relaxed">
              Após carregar pela primeira vez, o TheProg Editor funciona sem internet. Todos os arquivos e códigos criados ficam armazenados de forma persistente no banco de dados local do seu navegador.
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
