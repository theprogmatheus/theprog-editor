# 💻 TheProg Editor (v0.1.0)

> **IDE Web PWA 100% Offline com compilação e execução nativa em C e C++ via WebAssembly.**

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![PWA](https://img.shields.io/badge/PWA-100%25_Offline-emerald.svg)
![Language](https://img.shields.io/badge/Language-C%20%2F%20C%2B%2B-00599c.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)

O **TheProg Editor** é um ambiente de desenvolvimento integrado (IDE) que roda diretamente na aba do navegador, concebido com foco total em portabilidade, privacidade e autonomia. Ele permite escrever, formatar, compilar e executar programas em **C e C++** sem depender de servidores remotos, containers na nuvem ou conexão com a internet.

---

## 🚀 Principais Recursos

- **Compilador Clang Real no Navegador:** Compilação autêntica em WebAssembly através do `@yowasp/clang` com suporte a C11/C17 e C++17/C++20.
- **Pré-carregamento em Background & Execução Instantânea:** Os binários Wasm e headers do compilador são pré-carregados silenciosamente no boot da aplicação, eliminando esperas ao clicar em "Executar" e garantindo compilação em frações de segundo.
- **Terminal Interativo Completo com `stdin`:** Suporte a chamadas interativas como `scanf`, `getchar`, `cin` e `fgets` executadas em Web Worker com sincronização via `SharedArrayBuffer` e `Atomics`.
- **Editor Baseado no Monaco (VS Code):** Syntax highlighting preciso, autocompletion de sintaxe, bracket matching, controle de fonte dinâmico (Ctrl++ / Ctrl+-), atalhos familiares (`F5` para executar, `Ctrl+S` para salvar) e minimapa.
- **Formatação de Código Industrial:** Integração nativa com **Clang-Format** compilado para WebAssembly (`@wasm-fmt/clang-format`), permitindo formatar o código no padrão Google/LLVM com `Shift + Alt + F`.
- **Gerenciador de Arquivos & Árvore de Diretórios:** Criação, exclusão e renomeação de arquivos `.c`, `.cpp`, `.h`, `.hpp` e subpastas, com suporte a Drag & Drop e exportação completa do workspace em arquivo `.zip`.
- **Armazenamento 100% Local (IndexedDB):** Todos os arquivos, estados de abas e preferências são gravados de forma segura e durável no banco local do navegador.
- **PWA Instalável e Autônomo:** Instalável em desktops e tablets, funcionando em modo standalone mesmo totalmente desconectado da internet.
- **Ambiente de Emulação x86 (v86):** Suporte opcional à inicialização de máquinas virtuais x86 completas diretamente no browser utilizando BIOS SeaBIOS e VGABios.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
| :--- | :--- |
| **Framework UI** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build & Dev Tool** | [Vite](https://vite.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| **Editor de Código** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`) |
| **Terminal** | [Xterm.js](https://xtermjs.org/) + Fit Addon + WebLinks Addon |
| **Compilação C/C++** | [YoWASP Clang](https://yowasp.org/) + [`@bjorn3/browser_wasi_shim`](https://github.com/bjorn3/browser_wasi_shim) |
| **Formatador** | [Clang-Format Wasm](https://github.com/wasm-fmt/clang-format) |
| **Armazenamento** | [IndexedDB](https://developer.mozilla.org/pt-BR/docs/Web/API/IndexedDB_API) via biblioteca `idb` |
| **Emulador x86** | [v86](https://copy.sh/v86/) (SeaBIOS + VGABios) |
| **Offline / PWA** | `vite-plugin-pwa` + Workbox |

---

## 📁 Estrutura do Projeto

```text
theprog-editor/
├── public/
│   ├── favicon.svg          # Ícone da aplicação
│   └── v86/                 # Binários Wasm e BIOS para emulação x86
│       ├── bios/            # seabios.bin e vgabios.bin
│       └── v86.wasm         # Core Wasm do emulador v86
├── src/
│   ├── components/
│   │   ├── common/          # Componentes globais (Menu de Contexto, Loading)
│   │   ├── layout/          # Estrutura principal (TitleBar, Sidebar, EditorArea, TerminalPanel)
│   │   └── modals/          # Modais de Ajuda, Configurações e Máquina Virtual
│   ├── config/
│   │   └── version.ts       # Constante da versão atual da aplicação (v0.1.0)
│   ├── context/             # Estados globais (EditorContext, ThemeContext, DialogContext)
│   ├── hooks/               # Hooks customizados (useNetworkStatus)
│   ├── services/
│   │   ├── cCompiler.ts     # Pipeline de compilação Clang e execução WASI
│   │   ├── storage.ts       # Camada de persistência IndexedDB
│   │   └── vmManager.ts     # Orquestrador do terminal, shell e processos
│   ├── types/               # Tipagens TypeScript (FileItem, EditorTab, SupportedLanguage)
│   ├── utils/               # Utilitários (formatCode via clang-format)
│   └── workers/             # Web Workers isolados (wasmWorker para execução C/WASI)
├── index.html
├── package.json
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

> **Nota sobre Headers de Isolamento:** O servidor de desenvolvimento configura automaticamente `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Embedder-Policy: require-corp` para permitir o funcionamento ideal de `SharedArrayBuffer` e chamadas bloqueantes de `stdin` no terminal.

---

## 🌐 Deploy no GitHub Pages

O projeto possui integração contínua (CI/CD) configurada em `.github/workflows/deploy.yml`. A cada push na branch `main`, o GitHub Actions compila os assets estáticos e publica o site automaticamente:

1. No repositório GitHub, navegue até **Settings > Pages**.
2. Em **Build and deployment > Source**, selecione **GitHub Actions**.
3. O endereço publicado padrão será:
   ```text
   https://theprogmatheus.github.io/theprog-editor/
   ```

> **Nota sobre hospedagem estática gratuita:** O GitHub Pages não permite configurar cabeçalhos HTTP customizados (`COOP`/`COEP`). Caso os cabeçalhos não estejam presentes no navegador do usuário, o editor conta com um fallback automático que garante a compilação e execução de programas C/C++ sem requisições adicionais.

---

## 🔮 Recomendações de Evoluções Futuras

Com base na auditoria técnica de arquitetura, segurança e performance, as seguintes evoluções são recomendadas para as próximas versões:

### 1. Robustez do Shell e Sistema de Arquivos
- **Mapeamento de Pastas no Virtual FS:** Atualmente o compilador utiliza nomes planos para os arquivos. Permitir diretórios hierárquicos no Virtual File System possibilitará o uso transparente de includes como `#include "modulo/calculo.h"`.
- **Comandos Unix Essenciais:** Adicionar suporte no shell simulado para utilitários comuns de manipulação (`mkdir`, `rm`, `touch`, `cp`, `mv`), sincronizados em tempo real com a árvore de arquivos.
- **Histórico Persistente:** Salvar o histórico de comandos digitados no terminal no IndexedDB para que não seja perdido ao recarregar a página.

### 2. Otimização de Performance
- **Desacoplamento do Estado de Digitação:** Evitar atualizar o array global de arquivos (`files`) a cada caractere digitado no Monaco Editor. Utilizar um modelo desacoplado com *debounce* de persistência reduzirá o custo de re-renderização da árvore lateral de arquivos.
- **Pool de Web Workers:** Em vez de instanciar um novo Worker a cada clique em Executar (`F5`), manter uma instância reutilizável ou reaproveitável, acelerando o tempo de resposta da execução.

### 3. Debugging e Diagnósticos
- **Linter de Sintaxe em Tempo Real:** Integrar diagnósticos do Clang ou Language Server Protocol (LSP) em WebAssembly para exibir sublinhados vermelhos de erros de sintaxe diretamente no editor antes mesmo da compilação.
- **Suporte a Múltiplos Arquivos de Teste:** O sistema agora isola inteligentemente arquivos que possuem sua própria função `main()`. Futuras versões podem oferecer um seletor visual de alvo de build ou targets customizados via Makefile virtual.

### 4. Expansão Futura de Linguagens (Roadmap pós-v0.1)
- Quando o suporte a outras linguagens for reintroduzido:
  - **Python:** Utilizar **Pyodide** (CPython oficial compilado em Wasm) rodando obrigatoriamente dentro de um Web Worker dedicado com suporte a `stdin` via `Atomics`, garantindo que loops infinitos possam ser cancelados sem travar a interface.
  - **Rust / Go:** Explorar runtimes Wasm nativos oficiais para prover compilação real, evitando soluções baseadas em interpretação por regex.

---

## 📄 Licença

Este projeto é desenvolvido e mantido para fins educacionais e profissionais. Distribuído sob a licença MIT.
