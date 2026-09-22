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
import { LinuxLoadingScreen } from './components/common/LinuxLoadingScreen';
import { GlobalContextMenu } from './components/common/GlobalContextMenu';

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
    isSystemReady,
    systemProgressPercent,
    systemStatusMessage,
    systemStatus,
    currentScreen,
    recentWorkspaces,
    openLocalFolder,
    selectRecentWorkspace,
    removeRecentWorkspaceItem,
    openSandboxWorkspace,
    returnToEditor,
    hasEnteredEditorSession,
  } = useEditor();

  // 1. Carrega os ambientes de execução (Clang, Python e JS/TS) upfront antes mesmo de escolher o workspace
  if (!isSystemReady) {
    return (
      <LinuxLoadingScreen
        isLoading={!isSystemReady}
        progressPercent={systemProgressPercent}
        statusMessage={systemStatusMessage}
        isError={systemStatus === 'error'}
      />
    );
  }

  // 2. Com o sistema pronto, apresenta a seleção limpa de diretório/sandbox
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

  // 3. Ao escolher a pasta, abre o editor instantaneamente sem nenhum loading adicional
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
