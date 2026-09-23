# 💻 TheProg Editor (v0.6.0)

> **IDE Web PWA multilinguagem com compilação e execução nativas de C, C++, Python, JavaScript e TypeScript via WebAssembly — offline após o primeiro acesso.**

[![Produção](https://img.shields.io/badge/Acessar-matheus.eti.br%2Ftheprog--editor-007acc?style=flat&logo=googlechrome&logoColor=white)](https://matheus.eti.br/theprog-editor)
![Version](https://img.shields.io/badge/version-0.6.0-blue.svg)
![PWA](https://img.shields.io/badge/PWA-Offline_ap%C3%B3s_1%C2%BA_acesso-emerald.svg)
![Languages](https://img.shields.io/badge/Languages-C%20%7C%20C%2B%2B%20%7C%20Python%20%7C%20JS%20%7C%20TS-00599c.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)
[![Changelog](https://img.shields.io/badge/changelog-Keep%20a%20Changelog-orange.svg)](CHANGELOG.md)

O **TheProg Editor** é um ambiente de desenvolvimento integrado (IDE) que roda diretamente na aba do navegador, concebido com foco total em portabilidade, privacidade e autonomia. Ele permite escrever, formatar, compilar, interpretar e executar programas em **C, C++, Python, JavaScript e TypeScript** sem depender de servidores remotos ou containers na nuvem.

> **Sobre o modo offline:** no primeiro acesso é necessária conexão com a internet para baixar e cachear os ambientes de execução (Clang/LLVM, Pyodide e esbuild). A partir do segundo acesso, o editor opera integralmente offline como PWA instalável.

---

## 🚀 Principais Recursos

- **Cinco linguagens com execução real no navegador:**
  - **C/C++:** compilação autêntica com Clang (LLVM WebAssembly) e execução WASI.
  - **Python:** CPython completo via **Pyodide** (stdlib, entrada interativa, arquivos e pacotes via micropip).
  - **JavaScript/TypeScript:** empacotamento com **esbuild-wasm** (módulos locais `import`/`require`) e execução isolada em Web Worker.
  - **TypeScript com diagnósticos de tipo** no editor (TS worker nativo do Monaco).
- **ProcessManager & Execução Confiável:**
  - Orquestrador centralizado com PIDs monotônicos, controle de ciclo de vida e cancelamento atômico instantâneo via `worker.terminate()`.
  - Canal de entrada interativa em tempo real com fila FIFO de `stdin`, permitindo múltiplos `scanf()`/`cin`/`input()` sem perda de dados.
- **Explorador de Arquivos 2.0 de Alta Performance:**
  - Indexação linear plana baseada em dicionário O(1) de arquivos e pastas com cálculo de profundidade virtual.
  - Compactação visual inteligente de pastas em cadeia única (Folder Compaction estilo VS Code).
  - Criação rápida de caminhos aninhados em lote (ex.: `src/components/Button.tsx`).
  - Arrastar e soltar (Drag & Drop) nativo do SO ou interno para pastas específicas com destaque visual.
  - Sistema de abas com **Modo Preview** (itálico para navegação rápida) e fixação permanente por duplo clique ou edição.
- **Plataforma de Testes Automatizados (Estilo OBI / Beecrowd / LeetCode):**
  - Runner integrado de casos de teste com persistência em `.theprog/tests.json`.
  - Comparação de saída esperada vs. saída obtida com diff visual, tempos de execução e métricas de acerto.
- **Biblioteca de Snippets de Código:**
  - Inserção ágil de algoritmos, estruturas de dados e templates de código com busca rápida.
- **Recursos Avançados de Edição:**
  - **Modo Split View:** divisão horizontal e vertical para comparar ou editar múltiplos arquivos em paralelo.
  - **Markdown Preview:** renderização ao vivo com suporte a fórmulas matemáticas (KaTeX) e realce de sintaxe.
- **Controle de Versão Git Experimental (Offline-first):**
  - Integração client-side via `isomorphic-git` em Web Worker com IndexedDB FS.
  - Árvore de status em tempo real (Modificado, Não rastreado, Deletado), Stage/Unstage granular, histórico de commits e visualizador de diff via Monaco DiffEditor.
  - Módulo experimental que pode ser ativado ou desativado nas preferências do usuário.
- **Console Organizado em Abas (Ambiente & Execução):**
  - **Aba "Ambiente":** carregamento de runtimes, comando do compilador/empacotador, avisos e diagnósticos.
  - **Aba "Execução":** stdin/stdout/stderr do programa e mensagem de encerramento com tempo de execução e código de retorno.
- **Entrada Interativa em Tempo Real:** `scanf()`, `cin`, `input()` (Python) e `input()` (JavaScript) com sincronização via `SharedArrayBuffer` e `Atomics`.
- **Formatação por linguagem:** Clang-Format para C/C++, **black** para Python e indentação inteligente/TypeScript nativo para JS/TS.
- **Arquivos binários protegidos:** imagens ganham pré-visualização e binários exibem tela de proteção com download, sem corrupção no salvamento.
- **IntelliSense para C/C++ e Python:** catálogo de bibliotecas padrão, resolução de `#include`, snippets didáticos, hover e assinatura de funções.
- **Armazenamento 100% Local & Tipagem Estrita:** Virtual FS persistido em IndexedDB (`idb`) ou diretório do sistema operacional via File System Access API (WICG) sem conversões inseguras de tipo (`as any`).
- **PWA Instalável e Autônomo:** instalável em computadores e celulares, funcionando em janela própria e com cache offline inteligente.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
| :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build & Dev Tool** | [Vite](https://vite.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| **Editor de Código** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`) com Code Splitting |
| **Compilação C/C++** | [YoWASP Clang](https://yowasp.org/) isolado em Web Worker |
| **Runtime C/C++** | Web Worker isolado com [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim) |
| **Runtime Python** | [Pyodide](https://pyodide.org/) (CPython em WebAssembly) + `micropip` + `black` |
| **Runtime JS/TS** | [esbuild-wasm](https://esbuild.github.io/) (empacotamento) + sandbox em Web Worker |
| **Controle de Processos**| `ProcessManager` com identificadores monotônicos e cancelamento atômico |
| **Versionamento (Exp.)**| [isomorphic-git](https://isomorphic-git.org/) em Web Worker dedicado |
| **IntelliSense C/C++** | Service customizado (`cLanguageService.ts`) |
| **IntelliSense Python** | Snippets e palavras-chave (`pythonLanguageService.ts`) |
| **IntelliSense TS/JS** | TypeScript Language Service nativo do Monaco (`tsLanguageService.ts`) |
| **Console de Execução** | [Xterm.js](https://xtermjs.org/) + Fit Addon + WebLinks Addon (multi-instância) |
| **Formatador** | Clang-Format Wasm + black (Pyodide) |
| **Armazenamento** | [IndexedDB](https://developer.mozilla.org/pt-BR/docs/Web/API/IndexedDB_API) via `idb` + File System Access API nativa (WICG) |
| **Offline / PWA** | `vite-plugin-pwa` + Workbox (precache particionado + CacheFirst de wheels) |

---

## 📁 Estrutura do Projeto

```text
theprog-editor/
├── public/
│   ├── runtimes/
│   │   ├── pyodide-extras/    # wheels vendorizadas (micropip + black + deps)
│   │   ├── pyodide/           # copiado do node_modules no build
│   │   └── esbuild/           # copiado do node_modules no build
│   ├── favicon.svg
│   ├── pwa-192x192.png
│   └── pwa-512x512.png
├── scripts/
│   └── fetch-pyodide-extras.mjs  # baixa e fixa as wheels puras do Python
├── src/
│   ├── components/
│   │   ├── common/            # menus de contexto, loading, binário/imagem, diff viewer
│   │   ├── git/               # GitPanel e GitHistory (staging, commits, status)
│   │   ├── layout/            # TitleBar, Sidebar, EditorArea, TerminalPanel, SplitView
│   │   ├── modals/            # Configurações, Ajuda, Snippets, Testes e Sobre
│   │   └── tests/             # Painel e gerenciador de Casos de Teste
│   ├── config/
│   │   └── version.ts         # constante de versão da aplicação (v0.6.0)
│   ├── context/               # Estados globais (EditorContext, ThemeContext, DialogContext)
│   ├── hooks/                 # Hooks customizados (usePwaInstall, useNetworkStatus)
│   ├── services/
│   │   ├── git/               # gitService e integração com FS
│   │   ├── languages/         # registry de linguagens + capacidade de execução
│   │   ├── runtimes/          # adapters: clangRuntime, pythonRuntime, jsRuntime, manager
│   │   ├── monaco/            # IntelliSense C/C++, Python e TS/JS
│   │   ├── processManager.ts  # controle de PIDs, lifecycle e stdin FIFO
│   │   ├── cCompiler.ts       # pipeline Clang (cache + worker)
│   │   ├── pythonPackages.ts  # persistência offline de wheels Python
│   │   ├── localFs.ts         # integração WICG File System Access API estrita
│   │   ├── storage.ts         # camada de persistência IndexedDB
│   │   └── vmManager.ts       # console, status e orquestração de execução
│   ├── types/                 # Interfaces TypeScript e declarações WICG (filesystem.d.ts)
│   ├── utils/                 # Utilitários (formatCode, autoIndent, path utils)
│   └── workers/               # compilerWorker, wasmWorker, pythonWorker, jsWorker, gitWorker
├── CHANGELOG.md               # Histórico formal de mudanças e releases SemVer
├── index.html
├── package.json
└── vite.config.ts
```

---

## 🔬 Destaques de Arquitetura & Engenharia (v0.6.0)

### 1. ProcessManager & Isolamento de Execução
- **Identificadores Monotônicos (PID):** cada execução de script ou binário recebe um PID numérico estritamente crescente.
- **Cancelamento Atômico:** ao interromper via botão de parada ou `Ctrl+C`, o worker é abortado via `worker.terminate()` com liberação de portas e limpeza síncrona do estado do console.
- **Fila FIFO de Entrada (stdin):** sincronização confiável de fluxos de entrada (`scanf()`, `cin`, `input()`), prevenindo condições de corrida quando múltiplos dados são digitados.

### 2. Explorador de Arquivos 2.0 (High Performance)
- **Indexação O(1):** árvore linear plana baseada em dicionário de IDs com profundidade calculada, eliminando re-renderizações recursivas custosas do React DOM.
- **Folder Compaction:** diretórios aninhados sem bifurcações (ex.: `src/components/layout`) são visualmente condensados em uma linha única contínua, idêntico aos melhores editores profissionais de desktop.
- **Criação Rápida por Caminho:** suporta digitação de caminhos aninhados completos (ex.: `src/utils/format.ts`) criando automaticamente as pastas pai inexistentes.
- **Sistema de Abas Inteligente:** modo *Preview* dinâmico (título em itálico ao clicar uma vez para visualização rápida sem acumular abas) e fixação permanente por duplo clique ou alteração no arquivo.

### 3. Controle de Versão Git Experimental (Offline-first)
- **Web Worker Sandbox:** operações Git rodam em worker desacoplado (`gitWorker.ts`), evitando travamentos da UI durante indexações de commit ou hashing SHA-1.
- **IndexedDB Virtual Git FS:** preserva o repositório Git localmente sem necessidade de backend remoto ou conexão com a internet.
- **Diff Visual & Staging Granular:** visualização side-by-side de alterações com Monaco DiffEditor e interface visual para Stage/Unstage de arquivos modificados ou deletados.
- **Configurável:** recurso mantido como experimental e pode ser ligado/desligado diretamente nas Preferências do Usuário (desativado por padrão).

### 4. Otimização de Bundle & Precache PWA
- **Manual Chunks Granulares:** isolamento dos subsistemas pesados em chunks dedicados (`vendor-monaco`, `vendor-xterm`, `vendor-git`, `vendor-ui`).
- **Redução de 93% no Script de Entrada:** o chunk inicial `index.js` foi reduzido de **5,24 MB para 686 kB** (188 kB gzipped), garantindo carregamento ultrarrápido em redes móveis e dispositivos restritos.
- **Eliminação de Dependências e Binários Órfãos:** expurgo de bibliotecas legadas e do binário `v86.wasm` (-2,10 MB), reduzindo drasticamente o consumo de precache e armazenamento local.
- **Tipagem WICG Estrita:** declarações TypeScript ambientais em `src/types/filesystem.d.ts` substituindo 100% dos casts `as any` na File System Access API.

---

## 🐍 Pacotes Python offline

1. Com internet, abra **Configurações → Ambientes & Sistema → Ambiente Python** e instale pacotes (ex.: `numpy requests`).
2. O editor baixa a wheel, instala no Pyodide e **persiste os arquivos `.whl`** em `.theprog/py-packages/` (diretório local) ou no IndexedDB (sandbox).
3. Sem internet, ao abrir o mesmo projeto, os pacotes são reinstalados automaticamente a partir do cache.

Observação: pacotes com extensões nativas seguem a ABI do Pyodide; ao atualizar a versão do Pyodide, o manifesto é invalidado e os pacotes precisam ser reinstalados uma vez com internet.

---

## ✅ Verificação de execução offline (E2E)

O projeto inclui uma verificação automatizada que instala o Service Worker, aguarda o precache completo e então **simula falta de internet** (via CDP) para executar C, JS, TS e Python offline de verdade, além de reinstalar pacotes Python a partir do cache:

```bash
npm run build
npm run e2e:offline
```

O script usa o Chrome/Edge instalado na máquina (defina `CHROME_PATH` se necessário) e valida:

- Service Worker controlando a página e `crossOriginIsolated` ativo (SharedArrayBuffer);
- todos os assets de runtime respondendo `200` a partir do cache offline;
- execução de C, JavaScript, TypeScript e Python com código de saída `0`;
- reinstalação e `import` de pacotes Python (micropip) offline.

> O hook de QA usado pelo script (`window.__theprogDebug`) só é exposto em `localhost`/`127.0.0.1` com o parâmetro `?debug=1`.

> **Atualizações:** quando uma nova versão do Service Worker assume o controle, a página é recarregada automaticamente para manter o bundle e o precache sempre consistentes (evita falhas de execução offline após um deploy).

---

## ⚡ Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior
- Gerenciador de pacotes `npm`

### Passos:
1. Clone o repositório:
   ```bash
   git clone https://github.com/theprogmatheus/theprog-editor.git
   cd theprog-editor
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. (Opcional) Atualize as wheels puras do Python:
   ```bash
   node scripts/fetch-pyodide-extras.mjs --force
   ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

5. Acesse no navegador:
   ```text
   http://localhost:5173/theprog-editor/
   ```

> **Nota sobre Headers de Isolamento:** O servidor Vite configura automaticamente os cabeçalhos `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp` para permitir o funcionamento pleno de `SharedArrayBuffer` e chamadas bloqueantes de `stdin`.

---

## 🌐 Acesso em Produção & Infraestrutura

O **TheProg Editor** é hospedado via GitHub Pages e servido com proxy, SSL e aceleração de borda através da **Cloudflare** no endereço oficial de produção:

👉 **[https://matheus.eti.br/theprog-editor](https://matheus.eti.br/theprog-editor)**

### ⚡ Isolamento Cross-Origin e Stdin Interativo
Todas as respostas HTTP recebem os cabeçalhos de segurança para ativar o `SharedArrayBuffer` e `Atomics.wait` no navegador:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Resource-Policy: cross-origin`

### 🔄 Redirecionamento Canônico
Qualquer acesso originado de servidores ou espelhos não oficiais (como `theprogmatheus.github.io`) é redirecionado imediatamente para o endereço oficial **`https://matheus.eti.br/theprog-editor`**.

### 📱 Instalação como Aplicativo (PWA)
- **Desktop & Mobile:** instalável no Google Chrome, Microsoft Edge, Safari e navegadores móveis pelo botão **"Instalar App"**.
- **Janela Própria:** executa em modo *standalone*, integrado à barra de tarefas do sistema operacional.
- **Offline após o primeiro acesso:** o Service Worker mantém todos os ambientes, wheels e assets em cache.

---

## 📄 Licença

Este projeto é desenvolvido e mantido para fins educacionais e profissionais. Distribuído sob a licença MIT.
