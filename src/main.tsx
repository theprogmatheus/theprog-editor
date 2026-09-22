import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { registerCLanguageService } from './services/monaco/cLanguageService';
import { registerPythonLanguageService } from './services/monaco/pythonLanguageService';
import { setupTsLanguageService } from './services/monaco/tsLanguageService';
import { runtimeManager } from './services/runtimes/manager';
import { pythonRuntime } from './services/runtimes/pythonRuntime';
import { jsRuntime } from './services/runtimes/jsRuntime';
import { vmManager } from './services/vmManager';
import './index.css';
import App from './App.tsx';

// Força o Monaco Editor a carregar os módulos locais em vez de CDN externa
loader.config({ monaco });

// Inicializa provedores semânticos inteligentes (autocomplete de variáveis, funções, stdlib, snippets, hover)
registerCLanguageService(monaco);
registerPythonLanguageService(monaco);
setupTsLanguageService(monaco);

// Hook de QA para testes automatizados (apenas em localhost com ?debug=1)
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
if (isLocalhost && new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__theprogDebug = {
    runtimeManager,
    pythonRuntime,
    jsRuntime,
    vmManager,
  };
}

// Recarrega a página quando um novo Service Worker assume o controle.
// Sem isso, um bundle antigo pode tentar buscar assets que já foram removidos
// do precache (cleanupOutdatedCaches), quebrando a execução offline.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let isRefreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || isRefreshing) return;
    isRefreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
