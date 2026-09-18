import { X, Moon, Sun, RotateCcw, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { defaultFiles, saveFileToStorage } from '../../services/storage';
import { APP_VERSION } from '../../config/version';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();
  const { showConfirm } = useDialog();

  if (!isOpen) return null;

  const handleResetWorkspace = async () => {
    const confirmed = await showConfirm({
      title: 'Restaurar Workspace',
      message: 'Deseja restaurar o arquivo inicial padrão (main.c)? Todas as alterações atuais serão substituídas.',
      confirmText: 'Restaurar',
      cancelText: 'Cancelar',
      danger: true,
    });
    if (confirmed) {
      for (const file of defaultFiles) {
        await saveFileToStorage(file);
      }
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#3e3e42] rounded-lg shadow-2xl text-[#333333] dark:text-[#cccccc] overflow-hidden transition-colors">
        {/* Cabeçalho */}
        <div className="h-11 px-4 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#333333]">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-black dark:text-white">Configurações</h2>
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

        {/* Conteúdo */}
        <div className="p-5 space-y-5 text-xs">
          {/* Tema */}
          <div>
            <label className="block font-medium text-black dark:text-white mb-2">Tema da Interface</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center space-x-2 p-2.5 rounded border cursor-pointer ${
                  theme === 'dark'
                    ? 'border-[#007acc] bg-[#007acc]/10 text-white'
                    : 'border-[#cccccc] dark:border-[#3e3e42] hover:bg-[#f5f5f5] dark:hover:bg-[#2d2d2d]'
                }`}
              >
                <Moon className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                <span>VS Code Escuro</span>
              </button>

              <button
                onClick={() => setTheme('light')}
                className={`flex items-center space-x-2 p-2.5 rounded border cursor-pointer ${
                  theme === 'light'
                    ? 'border-[#007acc] bg-[#007acc]/10 text-[#007acc]'
                    : 'border-[#cccccc] dark:border-[#3e3e42] hover:bg-[#f5f5f5] dark:hover:bg-[#2d2d2d]'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>VS Code Claro</span>
              </button>
            </div>
          </div>

          {/* Persistência */}
          <div className="p-3 rounded bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-1.5">
            <div className="flex items-center space-x-2 font-medium text-black dark:text-white">
              <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Armazenamento Offline</span>
            </div>
            <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
              Todos os seus arquivos, edições e estado de execução são salvos no banco de dados local (IndexedDB)
              do seu navegador.
            </p>
          </div>

          {/* Restaurar template */}
          <div>
            <label className="block font-medium text-black dark:text-white mb-1">Zona de Recuperação</label>
            <button
              onClick={handleResetWorkspace}
              className="flex items-center space-x-2 px-3 py-2 rounded bg-[#f0f0f0] hover:bg-[#e4e4e4] dark:bg-[#333333] dark:hover:bg-[#3d3d3d] text-amber-700 dark:text-amber-300 border border-amber-500/30 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Template Inicial (main.c)</span>
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="h-12 px-4 bg-[#f8f8f8] dark:bg-[#1e1e1e] border-t border-[#e5e5e5] dark:border-[#333333] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#007acc] text-white font-medium hover:bg-[#0062a3] cursor-pointer"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
