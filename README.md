# 💻 TheProg Editor (v0.4.1)

> **IDE Web PWA 100% Offline com compilação e execução nativa em C e C++ via WebAssembly.**

[![Produção](https://img.shields.io/badge/Acessar-matheus.eti.br%2Ftheprog--editor-007acc?style=flat&logo=googlechrome&logoColor=white)](https://matheus.eti.br/theprog-editor)
![Version](https://img.shields.io/badge/version-0.4.1-blue.svg)
![PWA](https://img.shields.io/badge/PWA-100%25_Offline-emerald.svg)
![Language](https://img.shields.io/badge/Language-C%20%2F%20C%2B%2B-00599c.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)

O **TheProg Editor** é um ambiente de desenvolvimento integrado (IDE) que roda diretamente na aba do navegador, concebido com foco total em portabilidade, privacidade e autonomia. Ele permite escrever, formatar, compilar e executar programas em **C e C++** sem depender de servidores remotos, containers na nuvem ou conexão com a internet.

---

## 🚀 Principais Recursos

- **Compilador Clang Real no Navegador (WebAssembly):** Compilação autêntica através do `@yowasp/clang` com suporte completo a padrões C11/C17 e C++17/C++20.
- **Compilação Assíncrona em Web Worker Dedicado:** A compilação pesada do Clang roda isolada em segundo plano (`compilerWorker.ts`), garantindo **zero congelamentos de interface (0 UI freezes)**, permitindo continuar navegando e digitando fluentemente no editor.
- **Cache Instantâneo de Binários (Zero-Delay Re-run):** Mecanismo de hash de conteúdo para arquivos-fonte e cabeçalhos. Se o código não foi alterado desde a última compilação bem-sucedida, o editor reaproveita o binário em 0ms, indicando discretamente `(cached)` na finalização do processo.
- **Console Organizado em Abas (Compilação & Execução):**
  - **Aba "Compilação":** Exibe o comando executado pelo Clang, flags de compilação, avisos (*warnings*) e diagnósticos de erro. Se houver falha, a aba permanece aberta com a linha do erro destacada.
  - **Aba "Execução":** Canal limpo e dedicado exclusivamente às entradas e saídas do programa (*stdin*, *stdout*, *stderr*) e mensagem de encerramento com tempo de execução e código de retorno.
  - **Alternância Automática de Abas:** O editor alterna dinamicamente para a aba de compilação no início do processo e para a de execução assim que o binário é gerado, mantendo as duas saídas independentes e consultáveis a qualquer momento.
- **Botão Explícito "Compilar & Executar":** Identificação clara e direta na barra superior (`TitleBar`) e no menu de contexto com atalho rápido `F5`, permitindo também interromper (`Interromper` / `Ctrl+C`) com segurança.
- **IntelliSense & Autocompletar Inteligente para C e C++ (Monaco Editor):**
  - **Filtro Estrito de Bibliotecas:** O autocompletar (`Ctrl+Space`) exibe apenas funções, constantes e snippets das bibliotecas incluídas via `#include <...>` (como `<stdio.h>`, `<stdlib.h>`, `<string.h>`, `<iostream>`, `<vector>`, `<string>`, etc.) ou de arquivos locais `#include "..."`.
  - **Suporte C++ & STL:** Resolução de escopo para `std::` e detecção automática de `using namespace std;`, além de sugestão de métodos de containers (`vector`, `string`, `map`, etc.) ao digitar `.` ou `->`.
  - **Análise Semântica de Símbolos:** Detecção automática de variáveis, structs, classes, typedefs e funções declaradas no arquivo ou em cabeçalhos locais do projeto.
  - **Snippets Didáticos:** Modelos prontos com tabulação dinâmica (estruturas de repetição, condicionais, vetores, alocação dinâmica e templates).
  - **Hover Tooltips & Signature Help:** Dicas de documentação ao passar o cursor sobre funções e assistência de parâmetros em tempo real ao abrir parênteses `( )`.
- **Sistema de Arquivos Virtual Bidirecional (WASI):** Suporte autêntico a manipulação de arquivos com `fopen()`, `fread()`, `fwrite()`, `fprintf()`, `fscanf()`, `ifstream` e `ofstream`. Arquivos criados ou modificados pelo seu código aparecem instantaneamente na árvore de arquivos e são persistidos no IndexedDB.
- **100% Pronto para Ensino Acadêmico (AP1, AP2, ED1 e ED2):** Suporte nativo a ponteiros, structs, classes, alocação dinâmica (`malloc`/`free`/`new`/`delete`), listas encadeadas, pilhas, filas e árvores binárias.
- **Entrada Interativa com `stdin` em Tempo Real:** Suporte completo a chamadas bloqueantes como `scanf()`, `getchar()`, `cin` e `fgets()` executadas em Web Worker com sincronização via `SharedArrayBuffer` e `Atomics`.
- **Suporte Perfeito a Acentos (UTF-8 Streaming):** Leitura e impressão íntegras de caracteres acentuados da língua portuguesa (ã, ç, ó, é, etc.) sem perdas ou corrupções.
- **Formatação Industrial de Código:** Integração nativa com **Clang-Format** em WebAssembly (`@wasm-fmt/clang-format`), acessível via botão direito ou `Shift + Alt + F`.
- **Gerenciador de Arquivos Completo:** Criação, exclusão, renomeação e organização em diretórios via Drag & Drop, com exportação do projeto em arquivo ZIP.
- **Armazenamento 100% Local (IndexedDB):** Todos os arquivos, códigos e preferências são salvos no navegador sem envio a servidores externos.
- **PWA Instalável e Autônomo:** Instalável em computadores e celulares, funcionando em janela própria mesmo totalmente sem internet.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
| :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build & Dev Tool** | [Vite](https://vite.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| **Editor de Código** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`) |
| **Linguagem & IntelliSense** | Service Customizado de Language Features (`cLanguageService.ts`) |
| **Console de Execução** | [Xterm.js](https://xtermjs.org/) + Fit Addon + WebLinks Addon (Multi-instância) |
| **Compilação C/C++** | [YoWASP Clang](https://yowasp.org/) isolado em Web Worker |
| **Ambiente de Execução** | Web Worker isolado com [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim) |
| **Formatador** | [Clang-Format Wasm](https://github.com/wasm-fmt/clang-format) |
| **Armazenamento** | [IndexedDB](https://developer.mozilla.org/pt-BR/docs/Web/API/IndexedDB_API) via biblioteca `idb` |
| **Offline / PWA** | `vite-plugin-pwa` + Workbox |

---

## 📁 Estrutura do Projeto

```text
theprog-editor/
├── public/
│   ├── favicon.svg          # Ícone da aplicação
│   ├── pwa-192x192.png      # Ícone PWA para telas padrão
│   └── pwa-512x512.png      # Ícone PWA de alta resolução
├── src/
│   ├── components/
│   │   ├── common/          # Menus de contexto globais e tela de loading
│   │   ├── layout/          # TitleBar, Sidebar, EditorArea, TerminalPanel (com abas)
│   │   └── modals/          # Ajuda, Configurações e Informações do Sistema
│   ├── config/
│   │   └── version.ts       # Constante de versão da aplicação (v0.4.1)
│   ├── context/             # Estados globais (EditorContext, ThemeContext, DialogContext)
│   ├── hooks/               # Hooks customizados (usePwaInstall, useNetworkStatus)
│   ├── services/
│   │   ├── cCompiler.ts     # Pipeline de compilação Clang, cache e despacho para Worker
│   │   ├── monaco/          # IntelliSense, catálogos C/C++, analisador e snippets
│   │   │   ├── cLanguageService.ts
│   │   │   ├── cStdLibCatalog.ts
│   │   │   ├── cppStdLibCatalog.ts
│   │   │   ├── cSnippets.ts
│   │   │   ├── cppSnippets.ts
│   │   │   └── cSymbolAnalyzer.ts
│   │   ├── storage.ts       # Camada de persistência IndexedDB
│   │   └── vmManager.ts     # Gerenciador de terminais, abas e fluxo de execução
│   ├── types/               # Interfaces TypeScript (FileItem, EditorTab, VMStatus, ConsoleTab)
│   ├── utils/               # Utilitários (formatCode via clang-format)
│   └── workers/             # Web Workers isolados
│       ├── compilerWorker.ts# Worker dedicado para compilação assíncrona Clang
│       └── wasmWorker.ts    # Worker dedicado para execução WASI com stdin bloqueante
├── index.html               # Entry point com script de redirecionamento canônico
├── package.json             # Dependências e scripts de build (v0.4.1)
└── vite.config.ts           # Configurações de PWA, headers COOP/COEP e build
```

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

3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

4. Acesse no navegador:
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
O TheProg Editor cumpre todos os requisitos do padrão Progressive Web App:
- **Desktop & Mobile:** Pode ser instalado no Google Chrome, Microsoft Edge, Safari e navegadores móveis pelo botão **"Instalar App"** na barra superior ou pelo menu de configurações.
- **Janela Própria:** Executa em modo *standalone*, integrado à barra de tarefas do sistema operacional e sem interface do navegador.
- **100% Offline:** Após o primeiro acesso, o Service Worker garante funcionamento completo mesmo sem conexão à rede.

---

## 📄 Licença

Este projeto é desenvolvido e mantido para fins educacionais e profissionais. Distribuído sob a licença MIT.
