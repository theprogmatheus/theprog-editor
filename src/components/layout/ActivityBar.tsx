import React from 'react';
import { Files, Settings, HelpCircle } from 'lucide-react';
import { useEditor } from '../../context/EditorContext';

export type ActivityTab = 'explorer' | 'settings' | 'help';

interface ActivityBarProps {
  activeTab: ActivityTab;
  setActiveTab: (tab: ActivityTab) => void;
  onOpenHelp: () => void;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({ activeTab, setActiveTab, onOpenHelp }) => {
  const { isSidebarOpen, toggleSidebar } = useEditor();

  const handleExplorerClick = () => {
    if (activeTab === 'explorer') {
      toggleSidebar();
    } else {
      setActiveTab('explorer');
      if (!isSidebarOpen) {
        toggleSidebar();
      }
    }
  };

  return (
    <aside className="w-12 flex flex-col justify-between items-center py-2 bg-[#f0f0f0] dark:bg-[#333333] border-r border-[#e5e5e5] dark:border-[#252526] select-none text-[#616161] dark:text-[#858585] transition-colors shrink-0 z-20">
      {/* Ícone superior: Explorador */}
      <div className="flex flex-col items-center space-y-3 w-full">
        <button
          onClick={handleExplorerClick}
          title="Explorador de Arquivos (Clique para abrir/fechar barra lateral)"
          className={`w-10 h-10 flex items-center justify-center rounded cursor-pointer transition-colors relative ${
            activeTab === 'explorer' && isSidebarOpen
              ? 'text-black dark:text-white border-l-2 border-[#007acc] dark:border-white bg-black/5 dark:bg-white/5'
              : 'hover:text-black dark:hover:text-white'
          }`}
        >
          <Files className="w-5 h-5" />
        </button>
      </div>

      {/* Ícones inferiores: Ajuda e Configurações */}
      <div className="flex flex-col items-center space-y-3 w-full">
        <button
          onClick={onOpenHelp}
          title="Ajuda e Recursos do Editor"
          className="w-10 h-10 flex items-center justify-center rounded hover:text-black dark:hover:text-white cursor-pointer transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          title="Configurações"
          className={`w-10 h-10 flex items-center justify-center rounded cursor-pointer transition-colors relative ${
            activeTab === 'settings'
              ? 'text-black dark:text-white border-l-2 border-[#007acc] dark:border-white'
              : 'hover:text-black dark:hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </aside>
  );
};
