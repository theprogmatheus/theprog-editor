import React, { useState } from 'react';
import {
  X,
  Moon,
  Sun,
  RotateCcw,
  Monitor,
  Download,
  CheckCircle2,
  Laptop,
  Sliders,
  Save,
  Server,
  Cpu,
  HardDrive,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Info,
  ExternalLink,
  Heart,
  User,
  GraduationCap,
  FolderOpen,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import { useEditor } from '../../context/EditorContext';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { defaultFiles, saveFileToStorage } from '../../services/storage';
import { vmManager } from '../../services/vmManager';
import { APP_VERSION } from '../../config/version';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'general' | 'system' | 'about';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { theme, setTheme } = useTheme();
  const { showConfirm } = useDialog();
  const { isInstallable, isInstalled, installApp } = usePwaInstall();
  const {
    compilerFlags,
    setCompilerFlags,
    autoSave,
    setAutoSave,
    autoSaveDelay,
    setAutoSaveDelay,
    activeWorkspace,
    alwaysOpenLast,
    setAlwaysOpenLast,
    vmStatus,
    vmStatusMessage,
    compilerProgress,
    preloadCompiler,
    isSystemReady,
    systemStatus,
    systemProgressPercent,
  } = useEditor();

  const [flagsInput, setFlagsInput] = useState(compilerFlags.join(' '));
  const [customIsoUrl, setCustomIsoUrl] = useState('');
  const [isBooting, setIsBooting] = useState(false);

  if (!isOpen) return null;

  const isCoiActive = typeof window !== 'undefined' && Boolean(window.crossOriginIsolated);

  const handleFlagsBlur = () => {
    const tokens = flagsInput.trim().split(/\s+/).filter(Boolean);
    setCompilerFlags(tokens);
  };

  const handleResetWorkspace = async () => {
    const confirmed = await showConfirm({
      title: 'Restaurar Workspace',
      message: 'Deseja restaurar o arquivo inicial padrão (main.c)? Todas as alterações atuais da sandbox serão substituídas.',
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

  const handleStartV86 = async () => {
    setIsBooting(true);
    await vmManager.initV86(customIsoUrl.trim() || undefined);
    setIsBooting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#3e3e42] rounded-xl shadow-2xl text-[#333333] dark:text-[#cccccc] overflow-hidden flex flex-col transition-colors">
        {/* Cabeçalho Fixo */}
        <div className="h-12 px-5 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#333333] shrink-0 bg-[#fafafa] dark:bg-[#202021]">
          <div className="flex items-center space-x-2.5">
            <h2 className="text-sm font-bold text-black dark:text-white">Configurações & Ambiente</h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#007acc]/10 dark:bg-[#3794ff]/15 text-[#007acc] dark:text-[#3794ff] border border-[#007acc]/25 dark:border-[#3794ff]/25 font-normal">
              v{APP_VERSION}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#ececec] dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Navegação entre Abas */}
        <div className="flex items-center border-b border-[#e5e5e5] dark:border-[#333333] bg-[#f5f5f5] dark:bg-[#1e1e1e] px-4 shrink-0 text-xs font-medium">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center space-x-2 py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'general'
                ? 'border-[#007acc] text-[#007acc] dark:text-[#3794ff] font-semibold bg-white dark:bg-[#252526]'
                : 'border-transparent text-[#666666] dark:text-[#999999] hover:text-black dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Geral & Editor</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center space-x-2 py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'system'
                ? 'border-[#007acc] text-[#007acc] dark:text-[#3794ff] font-semibold bg-white dark:bg-[#252526]'
                : 'border-transparent text-[#666666] dark:text-[#999999] hover:text-black dark:hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Sistema & Linux</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isSystemReady ? 'bg-emerald-500' : systemStatus === 'error' ? 'bg-rose-500' : 'bg-blue-500 animate-ping'
              }`}
            />
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center space-x-2 py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'about'
                ? 'border-[#007acc] text-[#007acc] dark:text-[#3794ff] font-semibold bg-white dark:bg-[#252526]'
                : 'border-transparent text-[#666666] dark:text-[#999999] hover:text-black dark:hover:text-white'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Sobre & Créditos</span>
          </button>
        </div>

        {/* Corpo do Modal com Rolagem Independente */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {activeTab === 'general' && (
            <>
              {/* Tema da Interface */}
              <div>
                <label className="block font-semibold text-black dark:text-white mb-2">Tema da Interface</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      theme === 'dark'
                        ? 'border-[#007acc] bg-[#007acc]/10 text-white font-medium shadow-xs'
                        : 'border-[#cccccc] dark:border-[#3e3e42] hover:bg-[#f5f5f5] dark:hover:bg-[#2d2d2d]'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                    <span>VS Code Escuro</span>
                  </button>

                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      theme === 'light'
                        ? 'border-[#007acc] bg-[#007acc]/10 text-[#007acc] font-medium shadow-xs'
                        : 'border-[#cccccc] dark:border-[#3e3e42] hover:bg-[#f5f5f5] dark:hover:bg-[#2d2d2d]'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>VS Code Claro</span>
                  </button>
                </div>
              </div>

              {/* Preferência de Abertura Automática de Projeto */}
              <div className="p-3.5 rounded-xl bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-semibold text-black dark:text-white">
                    <FolderOpen className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
                    <span>Abertura Automática do Último Projeto</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={alwaysOpenLast}
                      onChange={(e) => setAlwaysOpenLast(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[#007acc]"></div>
                  </label>
                </div>
                <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
                  Ao inicializar o TheProg Editor, abre diretamente o último diretório do computador ou Sandbox utilizado, pulando a tela inicial.
                </p>
              </div>

              {/* Parâmetros de Compilação (Clang) */}
              <div className="p-3.5 rounded-xl bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-2.5">
                <div className="flex items-center space-x-2 font-semibold text-black dark:text-white">
                  <Sliders className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
                  <span>Parâmetros de Compilação (Clang)</span>
                </div>
                <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
                  Flags repassadas diretamente ao compilador Clang Wasm durante a execução do código (compatível com C e C++):
                </p>
                <input
                  type="text"
                  value={flagsInput}
                  onChange={(e) => setFlagsInput(e.target.value)}
                  onBlur={handleFlagsBlur}
                  placeholder="-O0 -Wall -Wextra"
                  className="w-full px-3 py-1.5 font-mono text-xs rounded-lg bg-white dark:bg-[#252526] border border-[#cccccc] dark:border-[#3e3e42] text-black dark:text-white focus:outline-none focus:border-[#007acc]"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { flags: ['-O0', '-Wall', '-Wextra'], label: '-O0 -Wall -Wextra (Padrão C/C++)' },
                    { flags: ['-O2', '-Wall', '-Wextra'], label: '-O2 -Wall -Wextra (Performance)' },
                    { flags: ['-O0', '-Wall', '-Wextra', '-Wpedantic'], label: '-O0 -Wall -Wextra -Wpedantic (Rigoroso)' },
                  ].map((preset) => {
                    const str = preset.flags.join(' ');
                    const isSelected = flagsInput.trim() === str;
                    return (
                      <button
                        key={str}
                        type="button"
                        onClick={() => {
                          setFlagsInput(str);
                          setCompilerFlags(preset.flags);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#007acc]/15 border-[#007acc] text-[#007acc] dark:text-[#3794ff] font-semibold'
                            : 'border-[#dddddd] dark:border-[#444444] hover:bg-[#eaeaea] dark:hover:bg-[#333333]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Salvamento Automático (Auto-Save) */}
              <div className="p-3.5 rounded-xl bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-semibold text-black dark:text-white">
                    <Save className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
                    <span>Salvar Automaticamente (Auto-Save)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSave}
                      onChange={(e) => setAutoSave(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[#007acc]"></div>
                  </label>
                </div>

                <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
                  Salva alterações continuamente no disco ou no sandbox ao pausar a digitação.
                  <br />
                  <strong className="text-black dark:text-white font-semibold">À prova de erros:</strong> Ao executar o código (F5 / Run), o salvamento é sempre imediato e automático, mesmo com o auto-save desligado.
                </p>

                {autoSave && (
                  <div className="pt-1 space-y-1.5">
                    <span className="text-[11px] font-medium text-black dark:text-white">
                      Tempo de Espera (Debounce):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { ms: 1000, label: '1.0s' },
                        { ms: 1500, label: '1.5s (Padrão)' },
                        { ms: 2000, label: '2.0s' },
                        { ms: 3000, label: '3.0s (Longo)' },
                      ].map((preset) => {
                        const isSelected = autoSaveDelay === preset.ms;
                        return (
                          <button
                            key={preset.ms}
                            type="button"
                            onClick={() => setAutoSaveDelay(preset.ms)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#007acc]/15 border-[#007acc] text-[#007acc] dark:text-[#3794ff] font-semibold'
                                : 'border-[#dddddd] dark:border-[#444444] hover:bg-[#eaeaea] dark:hover:bg-[#333333]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Armazenamento e Modo Offline */}
              <div className="p-3.5 rounded-xl bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-2">
                <div className="flex items-center space-x-2 font-semibold text-black dark:text-white">
                  <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Armazenamento & Resiliência</span>
                </div>
                <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
                  Todos os arquivos, configurações e estados de sessão são preservados localmente no seu computador ou no IndexedDB do navegador. O editor é resistente a oscilações e falta de internet.
                </p>
              </div>

              {/* Aplicativo PWA */}
              <div className="p-3.5 rounded-xl bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-semibold text-black dark:text-white">
                    <Laptop className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
                    <span>Aplicativo (PWA)</span>
                  </div>
                  {isInstalled ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Instalado</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      Navegador Web
                    </span>
                  )}
                </div>

                <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
                  {isInstalled
                    ? 'O TheProg Editor está operando no modo aplicativo independente (standalone).'
                    : 'Instale o TheProg Editor para abrir em janela própria, fixar na barra de tarefas e programar com foco total.'}
                </p>

                {isInstallable && (
                  <button
                    onClick={installApp}
                    className="w-full mt-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white font-medium cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Instalar Aplicativo Agora</span>
                  </button>
                )}
              </div>

              {/* Zona de Recuperação (Exibida APENAS quando em Sandbox Virtual) */}
              {activeWorkspace.type === 'sandbox' && (
                <div>
                  <label className="block font-semibold text-black dark:text-white mb-1.5">Zona de Recuperação (Sandbox)</label>
                  <button
                    onClick={handleResetWorkspace}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-[#f0f0f0] hover:bg-[#e4e4e4] dark:bg-[#333333] dark:hover:bg-[#3d3d3d] text-amber-700 dark:text-amber-300 border border-amber-500/30 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Template Inicial do Sandbox (main.c)</span>
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'system' && (
            <>
              {/* Card Resumo do Sistema */}
              <div className="p-3.5 bg-[#f3f4f6] dark:bg-[#1c1c1c] border border-[#e5e5e5] dark:border-[#333333] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-black dark:text-white">Status do Sistema</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center space-x-1.5 ${
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

                {!isSystemReady && (
                  <div className="w-full bg-[#e5e5e5] dark:bg-[#2d2d2d] h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(5, systemProgressPercent)}%` }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-[#666666] dark:text-[#888888] leading-relaxed">
                  O compilador Clang e a máquina virtual Linux operam inteiramente no cliente via WebAssembly, sem servidores intermediários.
                </p>
              </div>

              {/* 1. Compilador Clang WebAssembly (C/C++) */}
              <div className="p-3.5 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded-xl space-y-2">
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
                      ? `Carregando (${compilerProgress.percent}%)`
                      : 'Aguardando'}
                  </span>
                </div>
                <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
                  Binário Clang LLVM carregado no navegador com suporte completo às bibliotecas padrão libc/libstdc++ para compilação estática offline.
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

              {/* 2. Ambiente Linux & Runtime (v86 / WASI) */}
              <div className="p-3.5 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-black dark:text-white">2. Ambiente Linux & Runtime (v86 / WASI)</span>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                    {vmStatusMessage || vmStatus}
                  </span>
                </div>
                <p className="text-[#666666] dark:text-[#888888] leading-relaxed">
                  Emulador de arquitetura x86 e runtime POSIX WASI com isolamento em Web Worker, garantindo proteção contra travamentos do navegador.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#333333] rounded-lg space-y-0.5">
                    <div className="flex items-center space-x-1.5 font-medium text-black dark:text-white text-[11px]">
                      <Cpu className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                      <span>Processador</span>
                    </div>
                    <p className="text-[11px] text-[#666666] dark:text-[#888888]">x86 32-bit (Wasm JIT)</p>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#333333] rounded-lg space-y-0.5">
                    <div className="flex items-center space-x-1.5 font-medium text-black dark:text-white text-[11px]">
                      <HardDrive className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                      <span>Memória RAM</span>
                    </div>
                    <p className="text-[11px] text-[#666666] dark:text-[#888888]">256 MB (Wasm)</p>
                  </div>
                </div>
              </div>

              {/* 3. Entrada Interativa no Terminal */}
              <div className="p-3.5 bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] rounded-xl space-y-2">
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
                    ? 'O ambiente opera com Cross-Origin Isolation ativado. Entradas de dados em chamadas como scanf() e cin são capturadas diretamente no terminal em tempo real.'
                    : 'Para digitar entradas interativas durante a execução, acesse através do endereço oficial do TheProg Editor ou instale o aplicativo (PWA).'}
                </p>
                {!isCoiActive && (
                  <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-center justify-between">
                    <span>Endereço oficial: <strong>https://matheus.eti.br/theprog-editor</strong></span>
                    <a
                      href="https://matheus.eti.br/theprog-editor"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-[#007acc] text-white rounded hover:bg-[#0062a3] text-[11px] font-medium transition-colors"
                    >
                      Acessar
                    </a>
                  </div>
                )}
              </div>

              {/* Imagem Alpine Linux Opcional */}
              <div className="space-y-2">
                <label className="block font-semibold text-black dark:text-white">
                  Imagem do Alpine Linux / ISO Customizada (Opcional):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Ex: https://copy.sh/v86/build/alpine.iso ou deixe vazio para padrão"
                    value={customIsoUrl}
                    onChange={(e) => setCustomIsoUrl(e.target.value)}
                    className="flex-1 bg-white dark:bg-[#1e1e1e] border border-[#cccccc] dark:border-[#3e3e42] rounded-lg px-3 py-1.5 text-black dark:text-white outline-none focus:border-[#007acc]"
                  />
                  <button
                    onClick={handleStartV86}
                    disabled={isBooting}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white font-medium cursor-pointer shrink-0 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isBooting ? 'Reiniciando...' : 'Reiniciar VM'}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'about' && (
            <>
              {/* Card Destaque: Nome e Propósito do App */}
              <div className="p-4 rounded-xl bg-linear-to-r from-blue-500/10 via-[#007acc]/10 to-purple-500/10 border border-[#007acc]/25 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-base text-[#007acc] dark:text-[#3794ff]">TheProg Editor</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#007acc]/15 text-[#007acc] dark:text-[#3794ff] border border-[#007acc]/30 font-semibold">
                      v{APP_VERSION}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[#555555] dark:text-[#bbbbbb] leading-relaxed">
                  Ambiente de desenvolvimento integrado (IDE) web moderno e resiliente para programação em C e C++, operando com compilação WebAssembly cliente (Clang LLVM) e máquina virtual POSIX/WASI.
                </p>
              </div>

              {/* Autor e Universidade */}
              <div className="p-3.5 rounded-xl bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-2">
                <div className="flex items-center space-x-2 font-semibold text-black dark:text-white">
                  <User className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
                  <span>Autor do Projeto</span>
                </div>
                <div className="pl-6 space-y-1">
                  <p className="font-bold text-black dark:text-white text-xs">
                    Matheus Aguiar Dos Santos Ferreira
                  </p>
                  <p className="text-[11px] text-[#666666] dark:text-[#999999] flex items-center space-x-1">
                    <GraduationCap className="w-3.5 h-3.5 shrink-0 text-[#007acc] dark:text-[#3794ff]" />
                    <span>Discente de Bacharelado em Inteligência Artificial na Universidade Federal de Jataí (UFJ)</span>
                  </p>
                </div>
              </div>

              {/* Repositório Oficial no GitHub */}
              <div className="p-3.5 rounded-xl bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-semibold text-black dark:text-white">
                    <ExternalLink className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
                    <span>Código-Fonte & Repositório Oficial</span>
                  </div>
                  <a
                    href="https://github.com/theprogmatheus/theprog-editor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-[#007acc] hover:bg-[#0062a3] text-white font-medium text-[11px] transition-colors shadow-xs"
                  >
                    <span>Ver no GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[#666666] dark:text-[#888888] font-mono text-[11px]">
                  https://github.com/theprogmatheus/theprog-editor
                </p>
              </div>

              {/* Agradecimentos e Créditos Especiais */}
              <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-2">
                <div className="flex items-center space-x-2 font-semibold text-purple-800 dark:text-purple-300">
                  <Heart className="w-4 h-4 text-purple-600 dark:text-purple-400 fill-current" />
                  <span>Agradecimentos e Créditos Especiais</span>
                </div>
                <p className="text-xs text-purple-900/80 dark:text-purple-200/80 leading-relaxed">
                  Agradecimentos especiais aos <strong>alunos de Ciência da Computação e Inteligência Artificial</strong> por testarem, validarem em sala de aula e laboratório, e ajudarem continuamente com reports de bugs, sugestões e ideias para tornar o TheProg Editor cada vez melhor.
                </p>
              </div>

              {/* Observação de Resiliência e Compatibilidade */}
              <div className="p-3.5 rounded-xl bg-[#f8f8f8] dark:bg-[#1e1e1e] border border-[#e5e5e5] dark:border-[#333333] space-y-1.5">
                <span className="font-semibold text-black dark:text-white block">
                  Resiliência a Oscilações de Rede & PWA
                </span>
                <p className="text-[11px] text-[#666666] dark:text-[#888888] leading-relaxed">
                  O TheProg Editor foi construído para resistir a instabilidades e quedas temporárias de internet. O suporte completo à sincronização em tempo real de diretórios no disco e instalação autônoma (PWA) é garantido em navegadores com motor Chromium (Google Chrome, Microsoft Edge, Brave).
                </p>
              </div>
            </>
          )}
        </div>

        {/* Rodapé Fixo */}
        <div className="h-12 px-5 bg-[#fafafa] dark:bg-[#202021] border-t border-[#e5e5e5] dark:border-[#333333] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Resistente a oscilações e falta de internet</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#007acc] text-white font-semibold hover:bg-[#0062a3] cursor-pointer transition-colors shadow-xs"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
