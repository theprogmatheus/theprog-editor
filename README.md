# 💻 TheProg Editor (v0.6.0)

> **IDE Web PWA multilinguagem com compilação e execução nativas de C, C++, Python, JavaScript e TypeScript via WebAssembly — 100% client-side, zero backend e offline após o primeiro acesso.**

[![Produção](https://img.shields.io/badge/Acessar-matheus.eti.br%2Ftheprog--editor-007acc?style=flat&logo=googlechrome&logoColor=white)](https://matheus.eti.br/theprog-editor)
![Version](https://img.shields.io/badge/version-0.6.0-blue.svg)
![PWA](https://img.shields.io/badge/PWA-Offline_ap%C3%B3s_1%C2%BA_acesso-emerald.svg)
![Languages](https://img.shields.io/badge/Languages-C%20%7C%20C%2B%2B%20%7C%20Python%20%7C%20JS%20%7C%20TS-00599c.svg)
![Tests](https://img.shields.io/badge/tests-55%2F55%20passing-brightgreen.svg)
![Lint](https://img.shields.io/badge/oxlint-0%20errors-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)
[![Changelog](https://img.shields.io/badge/changelog-Keep%20a%20Changelog-orange.svg)](CHANGELOG.md)

O **TheProg Editor** é um ambiente de desenvolvimento integrado (IDE) que executa diretamente na aba do navegador, concebido com foco total em **portabilidade, privacidade absoluta e autonomia offline**. Ele permite escrever, formatar, compilar, interpretar e executar programas em **C, C++, Python, JavaScript e TypeScript** sem depender de servidores remotos, containers na nuvem ou instalações complexas no sistema operacional.

> **Sobre o modo offline:** no primeiro acesso é necessária conexão com a internet para baixar e armazenar em cache os ambientes de execução (Clang/LLVM, Pyodide e esbuild). A partir do segundo acesso, o editor opera de forma integralmente autônoma e offline como PWA (*Progressive Web App*).

---

## 🚀 Principais Recursos

### ⚡ 1. Ambientes de Execução & Compilação Nativos (WebAssembly)
- **C e C++:** Compilação autêntica com **Clang/LLVM** em WebAssembly e execução via runner WASI (`@bjorn3/browser_wasi_shim`) isolado em Web Worker.
- **Suporte a Múltiplos Arquivos C/C++:** Configuração declarativa via `.theprog/project.json` (especificando fontes, diretórios de include e flags do compilador) ou compilação vinculada automática.
- **Python:** CPython completo via **Pyodide** em WebAssembly com biblioteca padrão, entrada interativa (`input()`), manipulação de arquivos e pacotes via `micropip` com cache offline persistente (`.theprog/py-packages/`).
- **JavaScript & TypeScript:** Empacotamento de módulos locais (`import`/`require`) com **esbuild-wasm** e execução em sandbox de Web Worker. Diagnósticos estáticos de tipo em tempo real através do worker nativo do TypeScript no Monaco.
- **Lazy Loading Modular:** O download de runtimes pesados (Clang ~105MB, Pyodide ~30MB) só ocorre sob demanda quando um arquivo da respectiva linguagem é aberto ou executado, garantindo inicialização da IDE em sub-segundo.

### 🛡️ 2. Gerenciamento de Processos & Concorrência (`ProcessManager`)
- **Tabela de Processos Formal (PIDs):** Cada execução recebe um PID numérico monotônico estritamente crescente com máquina de estados finita (`idle` → `spawning` → `running` → `stopping` → `terminated`).
- **Cancelamento Atômico Instantâneo:** Interrupção de loops infinitos e processos travados com `Ctrl+C` ou botão Parar via `worker.terminate()`, sem vazamento de memória ou concorrência na thread principal.
- **Entrada Interativa com Backpressure:** Sincronização entre thread principal e workers via `SharedArrayBuffer` e `Atomics`. Fila FIFO na thread principal protege contra perda de entradas ao colar blocos multi-linha no terminal (`scanf()`, `cin`, `input()`).
- **Métricas de Execução:** Medição de tempo decorrido com precisão de milissegundos (`performance.now()`) e exibição de código de saída (*exit code*).

### 📁 3. Explorador de Arquivos 2.0 (High-Performance)
- **Indexação O(1):** Árvore linear plana baseada em dicionário de nós com cálculo de profundidade virtual, eliminando gargalos de recursão e re-renderizações desnecessárias no React DOM.
- **Compactação Inteligente de Pastas (*Folder Compaction*):** Pastas aninhadas em cadeia única de filho único (ex.: `src/components/layout`) são condensadas em uma única linha contínua, idêntico aos editores de desktop modernos.
- **Criação Rápida de Caminhos Aninhados:** Permite digitar caminhos compostos (ex.: `src/utils/math.c`), criando automaticamente todas as pastas intermediárias ausentes.
- **Filtro Rápido na Árvore (*Type-to-filter*):** Campo de busca integrado com atalho `Ctrl+F` e destaque visual de termos encontrados com `<mark>`.
- **Navegação por Teclado e Acessibilidade (WAI-ARIA):** Suporte integral a setas para navegação/expansão, `Enter` para abrir, `F2` para renomear e `Delete` para excluir.
- **Arrastar e Soltar (Drag & Drop):** Movimentação interna de arquivos/pastas com expansão automática de pastas após 500ms de hover, além de importação externa de arquivos do SO arrastados diretamente para pastas específicas.
- **Auto-Reveal Ativo:** Ao trocar de arquivo no editor, a árvore expande automaticamente as pastas ancestrais e realiza rolagem suave até o item.
- **Menu de Contexto Completo:** Ações para copiar caminho relativo, copiar nome, duplicar arquivo, baixar arquivo, renomear e excluir.
- **Esmaecimento Visual:** Arquivos de configuração iniciados com ponto (`.theprog`, `.gitignore`) recebem estilo atenuado para manter o foco no código.

### 📝 4. Editor de Código & Produtividade (Monaco Editor)
- **Code Splitting Otimizado:** Monaco Editor e language workers segregados do bundle principal, proporcionando carregamento ultra-rápido.
- **Sistema de Abas com Modo Preview:**
  - Clique simples: Abre o arquivo em **Modo Preview** (título em itálico), reutilizando a aba para navegação rápida sem acumular dezenas de abas abertas.
  - Duplo clique ou edição: Fixa a aba de forma permanente (*Pin*).
- **Modo Dividido (Split View):** Divisão de tela lado a lado (horizontal ou vertical) para inspecionar ou editar dois arquivos em paralelo com sincronização dinâmica.
- **Visualizador de Diferenças (Monaco DiffEditor):** Comparação side-by-side de modificações de código e staging do Git.
- **Live Markdown Preview:** Visualizador em tempo real de arquivos `.md` com renderização de fórmulas matemáticas (KaTeX), citações e realce de blocos de código.
- **Visualizador de Imagens:** Pré-visualização nativa de arquivos `.png`, `.jpg`, `.jpeg`, `.svg`, `.gif` e `.webp` com dimensões e tamanho do arquivo.
- **Proteção de Arquivos Binários:** Tela de proteção contra visualização corrompida de binários não suportados, prevenindo corrupção no salvamento e oferecendo download direto.
- **Formatação Automática de Código (`Shift+Alt+F`):**
  - C/C++: Clang-Format em WebAssembly.
  - Python: formatador **black** integrado via Pyodide.
  - JS/TS: formatador nativo do Monaco com indentação inteligente.
- **IntelliSense Avançado:** Catálogo completo de bibliotecas padrão de C, C++ e Python, resolução de `#include`, hover com documentação, autocompletar e snippets didáticos.

### 🏆 5. Plataforma de Casos de Teste (Estilo OBI / Beecrowd / LeetCode)
- **Aba "Testes & Casos" no Console:** Painel integrado dedicado ao treino de algoritmos e preparação para maratonas de programação e olimpíadas de informática.
- **Execução em Lote de Casos de Teste:** Cadastro de múltiplos pares de entrada padrão (`stdin`) e saída esperada (`stdout`).
- **Cálculo Automatizado de Vereditos:**
  - **AC** (*Accepted*): Saída idêntica à esperada.
  - **WA** (*Wrong Answer*): Diferença entre obtido e esperado, com visualizador de diff inline.
  - **TLE** (*Time Limit Exceeded*): Interrupção automática caso o algoritmo exceda o tempo limite configurado.
  - **RE** (*Runtime Error*): Captura de exceções e travamentos com stacktrace.
- **Persistência Declarativa:** Casos de teste salvos e versionados automaticamente em `.theprog/tests.json`.

### 📚 6. Biblioteca Didática de Algoritmos & Snippets
- Catálogo modal interativo acessível pela barra de título contendo implementações didáticas de referência prontas para inserção em 1 clique:
  - Árvore Binária de Busca com inserção e percurso em-ordem (C);
  - Algoritmo de Dijkstra para caminhos mínimos em grafos (C++);
  - Algoritmo QuickSort com particionamento de Lomuto (C);
  - Template oficial para Maratonas de Programação / OBI com I/O acelerado (C++).

### 🌿 7. Controle de Versão Git Experimental (100% Client-Side)
- **Offline-First:** Executa `isomorphic-git` no navegador sobre sistema de arquivos virtual persistido em IndexedDB (`git_fs`).
- **Isolamento em Web Worker:** Operações criptográficas SHA-1, diffs de árvore e commits são processados em thread secundária (`gitWorker.ts`), mantendo a digitação no editor sem nenhum atraso.
- **Interface Completa:**
  - Inicialização de repositório (`git init`);
  - Gerenciamento e alternância de branches locais;
  - Área de Staged e Unstaged Changes com ações granulares de Stage, Unstage e Descarte (*Discard Changes*);
  - Visualização de diff no Monaco DiffEditor lado a lado contra a versão `HEAD`;
  - Formulário de commit com suporte a `Ctrl+Enter` e listagem de histórico recente com hashes SHA.
  - Badges coloridas de status no explorador (`M`, `U`, `A`, `D`) e contador numérico na ActivityBar.
- **Recurso Opcional:** Mantido como experimental, ativável ou desativável nas Preferências do Usuário (desativado por padrão).

### 💾 8. Armazenamento Dual & Privacidade Absoluta
- **Disco Local (File System Access API - WICG):** Abra pastas reais do seu computador (Chrome, Edge, Opera) e edite arquivos com persistência direta e sincronização bidirecional, com tipagem estrita e zero conversões inseguras.
- **Sandbox Virtual (IndexedDB):** Espaço autocontido no navegador através da biblioteca `idb`, permitindo criar múltiplos projetos independentes com opção de exportação completa em formato `.zip`.
- **Tela de Boas-Vindas (*Welcome Screen*):** Histórico de espaços de trabalho recentes, alternância rápida e preferência para restaurar automaticamente o último projeto aberto.

### 🖥️ 9. Console Organizado em 3 Abas (`TerminalPanel`)
- **Aba "Ambiente":** Comandos do compilador, logs de inicialização de WebAssembly, tempos de carregamento e diagnósticos.
- **Aba "Execução":** Terminal interativo [Xterm.js](https://xtermjs.org/) completo com entrada em tempo real, suporte a links clicáveis, cores ANSI e ajuste dinâmico de layout (*Fit Addon*).
- **Aba "Testes & Casos":** Runner de validação automatizada de problemas de maratona com diffs e relatórios de tempo.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) + [TypeScript 5.8](https://www.typescriptlang.org/) | Interface reativa, modular e tipada |
| **Build & Tooling** | [Vite 8](https://vite.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) | Compilação ultrarrápida e design moderno |
| **Linter & Testes** | [oxlint](https://oxc.rs/) + [Vitest 5](https://vitest.dev/) | Análise estática em milissegundos e testes unitários |
| **Editor de Código** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`) | Motor de edição do VS Code no navegador com Code Splitting |
| **Terminal** | [Xterm.js 6](https://xtermjs.org/) + Fit Addon + WebLinks Addon | Emulação completa de console com stdin/stdout em tempo real |
| **Compilação C/C++** | [YoWASP Clang 22](https://yowasp.org/) isolado em Web Worker | Compilador LLVM autêntico para WebAssembly |
| **Runtime C/C++** | Web Worker isolado com [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim) | Camada WASI para execução segura de binários Wasm |
| **Runtime Python** | [Pyodide 314](https://pyodide.org/) + `micropip` + `black` | CPython completo em WebAssembly |
| **Runtime JS/TS** | [esbuild-wasm](https://esbuild.github.io/) + Sandbox em Web Worker | Empacotamento de módulos e execução esterilizada |
| **Controle de Processos** | `ProcessManager` com identificadores monotônicos (PIDs) | Gerenciamento de ciclo de vida e cancelamento atômico |
| **Controle de Versão** | [isomorphic-git 1.42](https://isomorphic-git.org/) em Web Worker | Git 100% client-side sobre IndexedDB |
| **Formatadores** | Clang-Format Wasm + black (Python) | Formatação profissional de código |
| **Armazenamento** | [IndexedDB](https://developer.mozilla.org/pt-BR/docs/Web/API/IndexedDB_API) via `idb` + WICG File System Access API | Armazenamento persistente local e direto no disco |
| **Offline & PWA** | `vite-plugin-pwa` + Workbox | Cache particionado, Service Worker e funcionamento offline |

---

## 📁 Estrutura do Projeto

```text
theprog-editor/
├── public/
│   ├── runtimes/
│   │   ├── pyodide-extras/       # Wheels puras vendorizadas (micropip, black, packaging)
│   │   ├── pyodide/              # Binários do Pyodide copiados no build
│   │   └── esbuild/              # esbuild.wasm copiado no build
│   ├── favicon.svg
│   ├── pwa-192x192.png
│   └── pwa-512x512.png
├── scripts/
│   ├── fetch-pyodide-extras.mjs  # Baixa e fixa as wheels puras do ecossistema Python
│   └── e2e-offline.mjs           # Teste E2E automatizado de execução offline via CDP
├── src/
│   ├── components/
│   │   ├── common/               # Context menus, loading, ImagePreview, MarkdownPreview
│   │   ├── layout/               # TitleBar, ActivityBar, Sidebar, EditorArea, TerminalPanel
│   │   ├── modals/               # SettingsModal, HelpModal, SnippetLibraryModal, WorkspacePicker
│   │   └── screens/              # WelcomeScreen (gerenciador de projetos recentes)
│   ├── config/
│   │   └── version.ts            # Versão canônica da aplicação (v0.6.0)
│   ├── context/                  # Estados globais (EditorContext, ThemeContext, DialogContext)
│   ├── hooks/                    # Hooks (usePwaInstall, useNetworkStatus)
│   ├── services/
│   │   ├── debugger/             # Gerenciamento de breakpoints e estado de depuração
│   │   ├── fileTree/             # Algoritmos de árvore O(1), pathUtils e compactação de pastas
│   │   ├── git/                  # Cliente RPC e motor GitEngine sobre IndexedDB
│   │   ├── languages/            # Registry de linguagens e capacidades de execução
│   │   ├── monaco/               # IntelliSense C/C++, Python e TS/JS
│   │   ├── process/              # ProcessManager (PIDs, lifecycle, fila FIFO de stdin)
│   │   ├── runtimes/             # Adapters: clangRuntime, pythonRuntime, jsRuntime, manager
│   │   ├── vfs/                  # Abstração de Virtual File System (VFile, buffers, streams)
│   │   ├── buildConfig.ts        # Parser e validador de .theprog/project.json
│   │   ├── cCompiler.ts          # Pipeline de compilação Clang
│   │   ├── localFs.ts            # Integração WICG File System Access API tipada
│   │   ├── pythonPackages.ts     # Gerenciamento e persistência offline de wheels Python
│   │   ├── storage.ts            # Camada de persistência IndexedDB com versionamento
│   │   ├── testRunner.ts         # Runner e validador de casos de teste
│   │   └── vmManager.ts          # Fachada de compatibilidade e controle do terminal
│   ├── types/                    # Contratos de tipos (editor.ts, filesystem.d.ts)
│   ├── utils/                    # Formatadores, detecção de indentação e helpers
│   └── workers/                  # compilerWorker, wasmWorker, pythonWorker, jsWorker, gitWorker
├── AUDITORIA_SISTEMICA.md        # Relatório formal da auditoria 360° de produto
├── CHANGELOG.md                  # Histórico formal de mudanças nos padrões SemVer
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔬 Destaques de Arquitetura & Otimizações (v0.6.0)

### 1. Code Splitting Agressivo & Redução de 93% no Script Inicial
No Vite (`vite.config.ts`), as bibliotecas de grande escala foram particionadas em camadas isoladas (`vendor-monaco`, `vendor-xterm`, `vendor-git`, `vendor-ui`). Com isso:
- O chunk de entrada principal (`dist/assets/index-*.js`) caiu de **5,24 MB para 686 kB** (188 kB gzipped) — uma **redução de 93%**.
- O tempo de carregamento da interface caiu para menos de 800ms, proporcionando usabilidade instantânea.

### 2. Eliminação de Dependências e Binários Mortos
- Remoção definitiva do emulador x86 legado e do arquivo `v86.wasm` (**2,10 MB**), expurgando assets obsoletos do precache.
- Remoção dos pacotes órfãos `v86` e `coi-serviceworker` do `package.json`.

### 3. Tipagem Estrita WICG (Zero `as any`)
- Criação de `src/types/filesystem.d.ts` definindo ambientemente os contratos da especificação WICG File System Access API (`showDirectoryPicker`, `FileSystemHandle.move`, `FileSystemWritableFileStream.write(BufferSource)` e `FileSystemDirectoryHandle.values()`).
- Refatoração de `src/services/localFs.ts` eliminando 100% dos 12 casts `as any` anteriores.

### 4. Sandboxing de Origem para JavaScript
- O `jsWorker.ts` conta com sanitização do escopo global que revoga o acesso a `indexedDB`, `caches`, `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker` e `BroadcastChannel`, prevenindo ataques de script malicioso e exfiltração de dados locais.

---

## ⚙️ Arquivos de Configuração do Projeto (`.theprog/`)

O editor reconhece arquivos especiais no diretório `.theprog/` na raiz do seu espaço de trabalho:

### 1. Compilação Multi-arquivo C/C++ (`.theprog/project.json`)
```json
{
  "entry": "src/main.cpp",
  "sources": [
    "src/main.cpp",
    "src/utils/math.cpp"
  ],
  "includeDirs": [
    "include"
  ],
  "flags": [
    "-Wall",
    "-O2",
    "-std=c++17"
  ]
}
```

### 2. Casos de Teste Automatizados (`.theprog/tests.json`)
```json
[
  {
    "id": "tc-1",
    "name": "Exemplo 1 - Entrada Básica",
    "stdin": "5\n1 2 3 4 5\n",
    "expectedStdout": "15\n"
  }
]
```

### 3. Pacotes Python Persistentes (`.theprog/py-packages/`)
- Diretório gerenciado automaticamente contendo as wheels (`.whl`) baixadas e instaladas via `micropip` para restauração offline.

---

## ⌨️ Atalhos de Teclado Principais

| Atalho | Ação |
| :--- | :--- |
| `F5` | Executar / Compilar & Executar o arquivo ativo |
| `Ctrl + C` / `Cmd + C` (no console) | Interromper a execução ativa (*Kill Process*) |
| `Shift + Alt + F` | Formatar o código do arquivo ativo |
| `Ctrl + S` / `Cmd + S` | Salvar o arquivo ativo no disco ou IndexedDB |
| `Ctrl + F` (no explorador) | Abrir campo de busca e filtro rápido na árvore |
| `F2` (no explorador) | Renomear o arquivo ou pasta selecionado |
| `Delete` (no explorador) | Excluir o arquivo ou pasta selecionado |
| `Ctrl + +` / `Ctrl + =` | Aumentar o tamanho da fonte do editor |
| `Ctrl + -` | Diminuir o tamanho da fonte do editor |
| `Ctrl + 0` | Redefinir a fonte do editor para o padrão (14px) |

---

## 🐍 Pacotes Python Offline

1. Com conexão à internet, abra **Configurações → Ambientes & Sistema → Ambiente Python** e instale pacotes (ex.: `numpy requests`).
2. O editor baixa a wheel, instala no Pyodide e **persiste os arquivos `.whl`** em `.theprog/py-packages/` (diretório local) ou no IndexedDB (sandbox).
3. Sem internet, ao abrir o mesmo projeto, os pacotes são reinstalados automaticamente a partir do cache local.

---

## ✅ Verificação de Execução Offline & Testes Automatizados

O projeto conta com suíte de testes unitários via Vitest e validação ponta a ponta (E2E) simulando falta de internet:

```bash
# Executa todos os testes unitários (55 testes em 12 suítes)
npm test

# Executa o linter ultrarrápido (oxlint)
npm run lint

# Executa a compilação do TypeScript e empacotamento com Vite
npm run build

# Valida execução offline de verdade via Chrome DevTools Protocol
npm run e2e:offline
```

O script E2E offline valida:
- Service Worker controlando a página e `crossOriginIsolated` ativo (`SharedArrayBuffer`);
- Todos os assets de runtime respondendo `200` a partir do cache offline do Service Worker;
- Execução de programas em C, JavaScript, TypeScript e Python com código de saída `0`;
- Reinstalação de pacotes Python (`micropip`) em modo estritamente offline.

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
- **Desktop & Mobile:** Instalável no Google Chrome, Microsoft Edge, Safari e navegadores móveis pelo botão **"Instalar App"**.
- **Janela Própria:** Executa em modo *standalone*, integrado à barra de tarefas do sistema operacional.
- **Offline Total:** O Service Worker mantém todos os ambientes, wheels e assets em cache durável.

---

## 📄 Licença

Este projeto é desenvolvido e mantido para fins educacionais e profissionais. Distribuído sob a licença MIT.
