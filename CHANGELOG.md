# Changelog — TheProg Editor

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere estritamente ao [Semantic Versioning (SemVer 2.0.0)](https://semver.org/spec/v2.0.0.html).

---

## [0.6.0] - 2026-09-23

Esta versão representa um marco de evolução na arquitetura, performance e experiência de desenvolvimento do **TheProg Editor**, consolidando o novo motor de processos determinístico, o sistema de arquivos virtual `VFile`, o explorador de arquivos *File Explorer 2.0*, o subsistema experimental de Git offline e uma redução massiva no tamanho do bundle de entrada.

### 🚀 Added
- **Controle de Versão Git Experimental (100% Offline & Client-Side):**
  - Motor de Git virtual (`GitEngine` e `GitIdbFs`) baseado em `isomorphic-git` persistido no IndexedDB (`git_fs`).
  - Execução assíncrona isolada em Web Worker dedicado (`gitWorker.ts`), eliminando congelamentos na UI.
  - Fluxo completo de staging (adicionar, desmarcar, desmarcar todos e descartar alterações com diálogo de confirmação).
  - Gerenciamento e alternância de branches locais com suporte a criação de novos ramos.
  - Integração com `<DiffEditor />` do Monaco Editor para comparação lado a lado entre o `HEAD` e a árvore de trabalho.
  - Badges coloridos de status Git em tempo real no explorador de arquivos (`M`, `U`, `A`, `D`) e contador numérico na `ActivityBar`.
  - Feature flag `enableGitExperimental: false` configurável em *Configurações > Geral & Editor*.
- **Tabela de Processos Formal (`ProcessManager`):**
  - Atribuição de PIDs monotônicos com ciclo de vida estrito (`idle` → `spawning` → `running` → `stopping` → `terminated`).
  - Fila FIFO com backpressure para `stdin`, protegendo contra perda de dados em digitação veloz ou colagem de blocos multilinha.
  - Cancelamento atômico e destruição forçada de threads em loops infinitos aritméticos (`while(1){}`) via `worker.terminate()`.
  - Temporizador de alta precisão com medição real do tempo de execução em milissegundos (`durationMs`).
- **File Explorer 2.0 (Alta Performance & Ergonomia):**
  - Indexação em tempo linear $O(V)$ memoizada em `buildDirectoryIndex`, dispensando bibliotecas pesadas de virtualização.
  - Criação de arquivos e pastas com caminhos aninhados automáticos (ex.: `src/components/Button.tsx`).
  - Compactação inteligente de pastas de nível único (estilo VS Code, ex.: `src/utils`).
  - Arrastar e soltar universal com suporte a movimentação interna e importação de múltiplos arquivos e pastas do sistema operacional (Explorer / Finder).
  - Ciclo de abas com modo de pré-visualização (itálico) e fixação permanente por duplo clique (`pinTab`).
  - Navegação completa por teclado com conformidade WAI-ARIA (setas direcionais, F2 para renomear, Delete para excluir).
  - Filtro instantâneo na árvore de arquivos com destaque visual por busca textual (*Type-to-Filter*).
- **Plataforma Educacional e Testes Automatizados:**
  - Painel de Casos de Teste integrado ao console inferior (`TerminalPanel`) com suporte a maratonas de programação (estilo OBI, Beecrowd e LeetCode).
  - Execução sequencial com cálculo automatizado de vereditos (*Accepted*, *Wrong Answer* com diff inline, *Time Limit Exceeded* e *Runtime Error*).
  - Persistência automática da suíte em `.theprog/tests.json`.
  - Catálogo didático de snippets com algoritmos clássicos (QuickSort, Dijkstra, Árvore Binária de Busca) e templates com I/O rápido.
- **Recursos Avançados de Edição:**
  - Split View nativo para edição simultânea lado a lado de dois arquivos.
  - Visualizador e renderizador seguro de Markdown em tempo real com realce de sintaxe.
  - Compilação declarativa multi-arquivo para projetos C/C++ via `.theprog/project.json`.
  - Tipagens ambientais estritas para WICG File System Access API (`src/types/filesystem.d.ts`).

### ⚡ Performance & Otimizações
- **Code-Splitting Granular no Vite:**
  - Configuração de `manualChunks` dividindo bibliotecas pesadas em chunks vendorizados isolados (`vendor-monaco`, `vendor-xterm`, `vendor-git`, `vendor-ui`).
  - **Redução de 93% no chunk principal:** O arquivo de entrada `index.js` caiu de **5.245 kB (5,24 MB)** para **686 kB** (188 kB gzipped), acelerando radicalmente o Time to Interactive (TTI).
- **Purga de Binários e Dependências Órfãs:**
  - Exclusão do diretório legado `public/v86` contendo o binário `v86.wasm` de **2.10 MB**, reduzindo o tamanho total do precache offline de **150 MB** para **148 MB**.
  - Remoção de dependências não utilizadas (`coi-serviceworker` e `v86`) do `package.json` e do manifesto do Service Worker.
- **Otimização do React Compiler e Hooks:**
  - Eliminação de alertas de `react(set-state-in-effect)` em `EditorArea.tsx`, prevenindo re-renderizações em cascata desnecessárias.

### 🔒 Security
- **Sandboxing de Execução JavaScript/TypeScript:**
  - Função `sanitizeGlobalScope()` em `jsWorker.ts` revogando acessos a APIs perigosas do navegador (`indexedDB`, `caches`, `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, `BroadcastChannel`), protegendo storages locais contra scripts maliciosos.

### 🐛 Fixed
- Resolução consolidada de todas as 29 inconsistências catalogadas em `A_CORRIGIR.md`, incluindo:
  - Proteção contra destruição acidental de arquivos locais $>5\text{ MB}$ através da trava `kind: 'too_large'`.
  - Correção na manipulação de arquivos binários gerados em WASI/Python, salvos como `Uint8Array` puro sem corrupção UTF-8.
  - Resolução de condição de corrida e vazamento de workers ao interromper códigos compilados.
  - Correção na exportação de workspaces como ZIP, preservando a integridade de binários e imagens.
  - Prevenção de deadlocks e loops de auto-sync em diretórios locais via `recordInternalWrite`.

---

## [0.5.0] - 2026-09-20

### Added
- Execução de C e C++ no navegador via YoWASP Clang e WASI (`@bjorn3/browser_wasi_shim`).
- Suporte a CPython completo via Pyodide em Web Worker isolado.
- Empacotamento e execução de JavaScript/TypeScript via `esbuild-wasm`.
- Entrada interativa no terminal (`scanf`, `cin`, `input`) via `SharedArrayBuffer` e `Atomics`.
- Persistência offline de pacotes Python instalados via `micropip` em `.theprog/py-packages/`.
- Suporte a diretórios locais do computador via File System Access API.
- Precache PWA completo com service worker Workbox e cabeçalhos de Cross-Origin Isolation (`COOP/COEP/CORP`).
