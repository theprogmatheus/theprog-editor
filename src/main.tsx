import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { registerCLanguageService } from './services/monaco/cLanguageService';
import './index.css';
import App from './App.tsx';

// Força o Monaco Editor a carregar os módulos locais em vez de CDN externa
loader.config({ monaco });

// Inicializa provedores semânticos inteligentes (autocomplete de variáveis, funções, stdlib, snippets, hover)
registerCLanguageService(monaco);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
