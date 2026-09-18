# 💻 TheProg Editor (v0.3.0)

> **IDE Web PWA 100% Offline com compilação e execução nativa em C e C++ via WebAssembly.**

[![Produção](https://img.shields.io/badge/Acessar-matheus.eti.br%2Ftheprog--editor-007acc?style=flat&logo=googlechrome&logoColor=white)](https://matheus.eti.br/theprog-editor)
![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)
![PWA](https://img.shields.io/badge/PWA-100%25_Offline-emerald.svg)
![Language](https://img.shields.io/badge/Language-C%20%2F%20C%2B%2B-00599c.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)

O **TheProg Editor** é um ambiente de desenvolvimento integrado (IDE) que roda diretamente na aba do navegador, concebido com foco total em portabilidade, privacidade e autonomia. Ele permite escrever, formatar, compilar e executar programas em **C e C++** sem depender de servidores remotos, containers na nuvem ou conexão com a internet.

---

## 🚀 Principais Recursos

- **Compilador Clang Real no Navegador:** Compilação autêntica em WebAssembly através do `@yowasp/clang` com suporte a C11/C17 e C++17/C++20.
- **Sistema de Arquivos Virtual Bidirecional (WASI):** Suporte autêntico e completo a manipulação de arquivos com `fopen()`, `fread()`, `fwrite()`, `fprintf()`, `fscanf()`, binários e texto. Arquivos criados ou modificados pelo seu código em C aparecem instantaneamente na árvore de arquivos do editor e são persistidos no IndexedDB, respeitando a hierarquia de diretórios!
- **100% Pronto para Ensino de AP1, AP2, ED1 e ED2:** Suporte nativo a ponteiros, estruturas heterogêneas (`struct`), alocação dinâmica (`malloc`/`free`), listas encadeadas, árvores binárias e persistência em arquivos de dados.
- **Console de Execução Autêntico & Minimalista:** Sem emulações ou shells simulados. O painel inferior atua como um console de execução limpo, exibindo exclusivamente as entradas e saídas do seu programa e diagnósticos reais do compilador.
- **Início Minimizado & Foco Automático (F5):** O console e a barra de arquivos iniciam recolhidos para maximizar a área de trabalho. Ao executar (`F5` ou botão Executar), o console se expande e o foco do teclado vai imediatamente para a digitação (`scanf()` / `cin`).
- **Design 100% Responsivo e Suporte Mobile:** Interface moderna adaptada para celulares e tablets, com barra lateral gaveta (drawer overlay com backdrop), minimap responsivo no Monaco e barra de abas com scroll touch.
- **Isolamento de Escopo por Diretório:** Cada pasta no gerenciador de arquivos atua como um escopo autônomo de projeto. Arquivos de exercícios ou pastas diferentes jamais interferem na compilação uns dos outros.
- **Parâmetros de Compilação Customizáveis (Clang Flags):** Configuração direta de flags (`-O2`, `-Wall`, `-std=c17`, `-g`) pelo modal de configurações, com presets rápidos em um clique.
- **Entrada Interativa com `stdin` em Tempo Real:** Suporte completo a chamadas bloqueantes como `scanf()`, `getchar()`, `cin` e `fgets()` executadas em Web Worker com sincronização por `SharedArrayBuffer` e `Atomics`.
- **Editor Baseado no Monaco (VS Code):** Destaque de sintaxe, indentação automática, bracket matching, controle dinâmico do tamanho da fonte e atalhos de teclado (`F5`, `Ctrl+S`, `Ctrl+F`).
- **Formatação de Código Industrial:** Integração nativa com **Clang-Format** em WebAssembly (`@wasm-fmt/clang-format`), permitindo formatar o código com `Shift + Alt + F`.
- **Gerenciador de Arquivos Completo:** Criação, exclusão, renomeação e organização de arquivos e subdiretórios via Drag & Drop, com botão de download do projeto em ZIP acessível na barra de atividades lateral.
- **Armazenamento 100% Local (IndexedDB):** Todos os arquivos, códigos e preferências são salvos localmente no navegador de forma durável.
- **PWA Instalável e Autônomo:** Instalável em computadores e celulares, funcionando em janela própria mesmo totalmente sem internet.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
| :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build & Dev Tool** | [Vite](https://vite.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| **Editor de Código** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`) |
| **Console de Execução** | [Xterm.js](https://xtermjs.org/) + Fit Addon + WebLinks Addon |
| **Compilação C/C++** | [YoWASP Clang](https://yowasp.org/) + [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim) |
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
│   │   ├── layout/          # TitleBar, Sidebar, EditorArea, TerminalPanel
│   │   └── modals/          # Ajuda, Configurações e Informações do Sistema
│   ├── config/
│   │   └── version.ts       # Constante de versão da aplicação (v0.2.0)
│   ├── context/             # Estados globais (EditorContext, ThemeContext, DialogContext)
│   ├── hooks/               # Hooks customizados (usePwaInstall, useNetworkStatus)
│   ├── services/
│   │   ├── cCompiler.ts     # Pipeline de compilação Clang Wasm e execução WASI
│   │   ├── storage.ts       # Camada de persistência IndexedDB
│   │   └── vmManager.ts     # Gerenciador do Console de Execução e streams
│   ├── types/               # Interfaces TypeScript (FileItem, EditorTab, SupportedLanguage)
│   ├── utils/               # Utilitários (formatCode via clang-format)
│   └── workers/             # Web Worker isolado (wasmWorker para execução C/WASI)
├── index.html               # Entry point com script de redirecionamento canônico
├── package.json             # Dependências e scripts de build (v0.2.0)
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
Através do Cloudflare, todas as respostas HTTP recebem os cabeçalhos de isolamento de segurança:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Resource-Policy: cross-origin`

Esses cabeçalhos ativam o uso de `SharedArrayBuffer` e `Atomics.wait` no navegador, viabilizando a compilação C/C++ e a execução de chamadas bloqueantes de `stdin` (como `scanf()`, `cin`, `getchar()` e `fgets()`) diretamente no console em tempo real.

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
