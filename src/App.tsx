import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './context/DialogContext';
import { EditorProvider, useEditor } from './context/EditorContext';
import { TitleBar } from './components/layout/TitleBar';
import { ActivityBar, type ActivityTab } from './components/layout/ActivityBar';
import { Sidebar } from './components/layout/Sidebar';
import { EditorArea } from './components/layout/EditorArea';
import { TerminalPanel } from './components/layout/TerminalPanel';
import { SettingsModal } from './components/modals/SettingsModal';
import { HelpModal } from './components/modals/HelpModal';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { GlobalContextMenu } from './components/common/GlobalContextMenu';
import { GitPanel } from './components/layout/GitPanel';

const MainLayout: React.FC = () => {
  const [activeActivityTab, setActiveActivityTab] = useState<ActivityTab>('explorer');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    document.title = 'TheProg Editor';
  }, []);

  const handleActivityChange = (tab: ActivityTab) => {
    if (tab === 'settings') {
      setIsSettingsOpen(true);
    } else if (tab === 'help') {
      setIsHelpOpen(true);
    } else {
      setActiveActivityTab(tab);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden font-sans select-none bg-white dark:bg-[#1e1e1e] text-[#333333] dark:text-[#cccccc] transition-colors">
      {/* Topo: TitleBar */}
      <TitleBar onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Centro: ActivityBar + Sidebar + Editor/Terminal */}
      <div className="flex-1 flex overflow-hidden">
        <ActivityBar
          activeTab={activeActivityTab}
          setActiveTab={handleActivityChange}
          onOpenHelp={() => setIsHelpOpen(true)}
        />

        {activeActivityTab === 'explorer' && <Sidebar />}
        {activeActivityTab === 'git' && (
          <div className="w-64 h-full border-r border-[#e5e5e5] dark:border-[#252526] shrink-0">
            <GitPanel />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorArea />
          <TerminalPanel />
        </div>
      </div>

      {/* Modais */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Menu de Contexto Global */}
      <GlobalContextMenu
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />
    </div>
  );
};

const MainApp: React.FC = () => {
  const {
    currentScreen,
    recentWorkspaces,
    openLocalFolder,
    selectRecentWorkspace,
    removeRecentWorkspaceItem,
    openSandboxWorkspace,
    returnToEditor,
    hasEnteredEditorSession,
  } = useEditor();

  if (currentScreen === 'welcome') {
    return (
      <WelcomeScreen
        recentWorkspaces={recentWorkspaces}
        onOpenLocalFolder={openLocalFolder}
        onSelectRecent={selectRecentWorkspace}
        onRemoveRecent={removeRecentWorkspaceItem}
        onOpenSandbox={openSandboxWorkspace}
        canReturnToEditor={hasEnteredEditorSession}
        onReturnToEditor={returnToEditor}
      />
    );
  }

  return <MainLayout />;
};

export function App() {
  return (
    <ThemeProvider>
      <DialogProvider>
        <EditorProvider>
          <MainApp />
        </EditorProvider>
      </DialogProvider>
    </ThemeProvider>
  );
}

export default App;
