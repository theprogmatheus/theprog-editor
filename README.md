# 💻 TheProg Editor (v0.5.0)

> **IDE Web PWA multilinguagem com compilação e execução nativas de C, C++, Python, JavaScript e TypeScript via WebAssembly — offline após o primeiro acesso.**

[![Produção](https://img.shields.io/badge/Acessar-matheus.eti.br%2Ftheprog--editor-007acc?style=flat&logo=googlechrome&logoColor=white)](https://matheus.eti.br/theprog-editor)
![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)
![PWA](https://img.shields.io/badge/PWA-Offline_ap%C3%B3s_1%C2%BA_acesso-emerald.svg)
![Languages](https://img.shields.io/badge/Languages-C%20%7C%20C%2B%2B%20%7C%20Python%20%7C%20JS%20%7C%20TS-00599c.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)

O **TheProg Editor** é um ambiente de desenvolvimento integrado (IDE) que roda diretamente na aba do navegador, concebido com foco total em portabilidade, privacidade e autonomia. Ele permite escrever, formatar, compilar, interpretar e executar programas em **C, C++, Python, JavaScript e TypeScript** sem depender de servidores remotos ou containers na nuvem.

> **Sobre o modo offline:** no primeiro acesso é necessária conexão com a internet para baixar e cachear os ambientes de execução (Clang/LLVM, Pyodide e esbuild). A partir do segundo acesso, o editor opera integralmente offline como PWA instalável.

---

## 🚀 Principais Recursos

- **Cinco linguagens com execução real no navegador:**
  - **C/C++:** compilação autêntica com Clang (LLVM WebAssembly) e execução WASI.
  - **Python:** CPython completo via **Pyodide** (stdlib, entrada interativa, arquivos e pacotes via micropip).
  - **JavaScript/TypeScript:** empacotamento com **esbuild-wasm** (módulos locais `import`/`require`) e execução isolada em Web Worker.
  - **TypeScript com diagnósticos de tipo** no editor (TS worker nativo do Monaco).
- **Botão de execução dinâmico:** o botão "Executar" / "Compilar & Executar" só é habilitado quando o arquivo ativo é executável (por exemplo, exige `main()` em C/C++) e o ambiente correspondente está pronto, sempre com o motivo exibido no tooltip.
- **Cache completo para uso offline:** todos os runtimes (Clang, Pyodide, esbuild), wheels de formatação e pacotes Python instalados são cacheados no Service Worker, no IndexedDB e/ou no próprio diretório do projeto (`.theprog/py-packages/`).
- **Pacotes Python persistentes:** instale com `micropip` (ex.: `numpy`, `requests`) uma única vez online; depois o pacote é reinstalado automaticamente offline a partir do cache do projeto.
- **Console Organizado em Abas (Ambiente & Execução):**
  - **Aba "Ambiente":** carregamento de runtimes, comando do compilador/empacotador, avisos e diagnósticos.
  - **Aba "Execução":** stdin/stdout/stderr do programa e mensagem de encerramento com tempo de execução e código de retorno.
- **Entrada Interativa em Tempo Real:** `scanf()`, `cin`, `input()` (Python) e `input()` (JavaScript) com sincronização via `SharedArrayBuffer` e `Atomics`, incluindo `Ctrl+C` para interromper loops infinitos.
- **Formatação por linguagem:** Clang-Format para C/C++, **black** para Python e indentação inteligente/TypeScript nativo para JS/TS.
- **Arquivos binários protegidos:** imagens ganham pré-visualização e binários exibem "Visualização não suportada" (com download e opção de forçar leitura como texto), sem risco de corrupção no salvamento.
- **IntelliSense para C/C++ e Python:** catálogo de bibliotecas padrão, resolução de `#include`, snippets didáticos, hover e assinatura de funções (C/C++), além de snippets e palavras-chave (Python).
- **Sistema de Arquivos Virtual Bidirecional:** arquivos criados ou modificados pelo código aparecem instantaneamente na árvore e são persistidos no IndexedDB ou no disco.
- **Armazenamento 100% Local:** todos os arquivos, códigos e preferências ficam no navegador (IndexedDB) ou em pastas locais do computador, sem envio a servidores externos.
- **PWA Instalável e Autônomo:** instalável em computadores e celulares, funcionando em janela própria.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
| :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build & Dev Tool** | [Vite](https://vite.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| **Editor de Código** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`) |
| **Compilação C/C++** | [YoWASP Clang](https://yowasp.org/) isolado em Web Worker |
| **Runtime C/C++** | Web Worker isolado com [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim) |
| **Runtime Python** | [Pyodide](https://pyodide.org/) (CPython em WebAssembly) + `micropip` + `black` |
| **Runtime JS/TS** | [esbuild-wasm](https://esbuild.github.io/) (empacotamento) + sandbox em Web Worker |
| **IntelliSense C/C++** | Service customizado (`cLanguageService.ts`) |
| **IntelliSense Python** | Snippets e palavras-chave (`pythonLanguageService.ts`) |
| **IntelliSense TS/JS** | TypeScript Language Service nativo do Monaco (`tsLanguageService.ts`) |
| **Console de Execução** | [Xterm.js](https://xtermjs.org/) + Fit Addon + WebLinks Addon (multi-instância) |
| **Formatador** | Clang-Format Wasm + black (Pyodide) |
| **Armazenamento** | [IndexedDB](https://developer.mozilla.org/pt-BR/docs/Web/API/IndexedDB_API) via biblioteca `idb` |
| **Offline / PWA** | `vite-plugin-pwa` + Workbox (precache + CacheFirst de wheels) |

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
│   │   ├── common/            # menus de contexto, loading, binário/imagem
│   │   ├── layout/            # TitleBar, Sidebar, EditorArea, TerminalPanel
│   │   └── modals/            # Ajuda, Configurações (Ambientes) e Sobre
│   ├── config/
│   │   └── version.ts         # constante de versão da aplicação (v0.5.0)
│   ├── context/               # Estados globais (EditorContext, ThemeContext, DialogContext)
│   ├── hooks/                 # Hooks customizados (usePwaInstall, useNetworkStatus)
│   ├── services/
│   │   ├── languages/         # registry de linguagens + capacidade de execução
│   │   ├── runtimes/          # adapters: clangRuntime, pythonRuntime, jsRuntime, manager
│   │   ├── monaco/            # IntelliSense C/C++, Python e TS/JS
│   │   ├── cCompiler.ts       # pipeline Clang (cache + worker)
│   │   ├── pythonPackages.ts  # persistência offline de wheels Python
│   │   ├── localFs.ts         # leitura/escrita no disco + detecção de binários
│   │   ├── storage.ts         # camada de persistência IndexedDB
│   │   └── vmManager.ts       # console, status e orquestração de execução
│   ├── types/                 # Interfaces TypeScript
│   ├── utils/                 # Utilitários (formatCode, autoIndent)
│   └── workers/               # compilerWorker, wasmWorker, pythonWorker, jsWorker, bundlerWorker
├── index.html
├── package.json
└── vite.config.ts
```

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
