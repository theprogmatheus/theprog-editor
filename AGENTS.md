# 🤖 AGENTS.md — Prompt Inicial & Manual Operacional para Agentes de IA

> **Atenção para qualquer Agente de IA (Cursor, Windsurf, Claude, Copilot, Antigravity, Devin, etc.):**  
> Este arquivo é a sua **instrução inicial primária** ao interagir com o repositório **TheProg Editor**.  
> Leia este documento na íntegra antes de propor, modificar ou executar qualquer código. Ele orienta como você deve pensar, quais regras são inegociáveis e como navegar pelo acervo técnico detalhado em [`.docs/`](file:///.docs/INDEX.md).

---

## 1. Identidade e Filosofia do Projeto

O **TheProg Editor** é uma IDE Web PWA multilinguagem com compilação e execução nativas via WebAssembly (C, C++, Python, JavaScript e TypeScript).

### 🛡️ Regras de Ouro Inegociáveis (Golden Invariants)

1. **100% Client-Side & Zero Backend:**
   - O projeto NÃO possui, NÃO aceita e NUNCA dependerá de servidor backend para compilação, execução ou armazenamento.
   - Qualquer sugestão de "enviar código para uma API remota" ou "subir um container Docker para executar" viola a premissa existencial do projeto.
2. **Suporte Offline Autônomo (Offline-First PWA):**
   - Após o primeiro acesso (quando os runtimes Wasm são cacheados), a aplicação deve funcionar de forma 100% autônoma sem sinal de internet.
   - Nenhuma biblioteca ou asset pode depender de links de CDN externos não cacheados pelo Service Worker (`src/sw.ts`).
3. **Isolamento de Origem Cruzada (COOP / COEP):**
   - A aplicação depende estritamente dos cabeçalhos:
     - `Cross-Origin-Opener-Policy: same-origin`
     - `Cross-Origin-Embedder-Policy: require-corp`
     - `Cross-Origin-Resource-Policy: cross-origin`
   - Esses cabeçalhos são mandatórios para habilitar `SharedArrayBuffer` e `Atomics`, usados na entrada síncrona do terminal (`scanf()`, `cin`, `input()`).
4. **Preservação de Dados e Integridade de Binários:**
   - **Nunca** decodifique buffers de arquivos desconhecidos ou binários (`Uint8Array`) para strings UTF-8 de forma ingênua (sob risco de corromper bytes com `\uFFFD`).
   - Arquivos com tamanho $> 5\text{ MB}$ no disco local recebem `kind: 'too_large'` e são travados como *read-only* para impedir truncamento destrutivo do arquivo físico do usuário.
5. **Tipagem Estrita (Zero `as any` injustificado):**
   - Todo código TypeScript novo ou editado deve possuir tipagem estrita. APIs Web emergentes (como File System Access API) devem ser declaradas em `src/types/filesystem.d.ts`.
6. **Concorrência e Workers Isolados:**
   - Compiladores (Clang), interpretadores (Pyodide), bundlers (esbuild) e Git (isomorphic-git) **devem rodar isolados em Web Workers**. A thread de UI (React DOM) nunca deve ser bloqueada com computação pesada.

---

## 2. Mapa de Navegação da Documentação (`.docs/`)

Para que você não precise inferir ou adivinhar a arquitetura, todas as decisões, diagramas, padrões e especificações técnicas foram formalizados no diretório [`.docs/`](file:///.docs/INDEX.md).

### 🧭 Roteador de Tarefas: "O que você vai fazer?"

| Se a sua tarefa envolve... | Consulte o documento obrigatório: | Tópicos Cobertos |
| :--- | :--- | :--- |
| **Entender a arquitetura global ou fluxo de dados** | [`.docs/01_ARCHITECTURE.md`](file:///.docs/01_ARCHITECTURE.md) | Diagrama de camadas, ciclo de vida, comunicação via Workers, SharedArrayBuffer. |
| **Execução de código, compiladores ou ProcessManager** | [`.docs/02_RUNTIMES_AND_EXECUTION.md`](file:///.docs/02_RUNTIMES_AND_EXECUTION.md) | YoWASP Clang, Pyodide, esbuild-wasm, `ProcessManager`, PIDs, FIFO stdin, Atomics. |
| **Manipulação de arquivos, VFS ou disco local** | [`.docs/03_STORAGE_AND_VFS.md`](file:///.docs/03_STORAGE_AND_VFS.md) | File System Access API, IndexedDB schema v4, `VFile`, `treeIndex.ts` $O(V)$, compactação de pastas. |
| **Controle de versão Git, staging ou diffs** | [`.docs/04_GIT_SUBSYSTEM.md`](file:///.docs/04_GIT_SUBSYSTEM.md) | `isomorphic-git`, `gitWorker.ts`, `GitIdbFs`, Monaco DiffEditor, branch/staging. |
| **Interface visual, Monaco Editor, abas ou layout** | [`.docs/05_UI_AND_COMPONENTS.md`](file:///.docs/05_UI_AND_COMPONENTS.md) | React 19, Split View, Monaco configs, Xterm.js, modals, contextos globais. |
| **Segurança, sandboxing ou isolamento COOP/COEP** | [`.docs/06_SECURITY_AND_SANDBOXING.md`](file:///.docs/06_SECURITY_AND_SANDBOXING.md) | `sanitizeGlobalScope` em JS, cabeçalhos de segurança, permissões WICG, limites de sandbox. |
| **PWA, Service Worker, cache ou funcionamento offline** | [`.docs/07_OFFLINE_AND_PWA.md`](file:///.docs/07_OFFLINE_AND_PWA.md) | Workbox, `sw.ts`, `coopCoepPlugin`, cache partitioning, lazy loading. |
| **Padrões de código, tipagem, linter e convenções** | [`.docs/08_CONVENTIONS_AND_STANDARDS.md`](file:///.docs/08_CONVENTIONS_AND_STANDARDS.md) | ESLint/Oxlint, TypeScript, Conventional Commits, SemVer 2.0, lições de `A_CORRIGIR.md`. |
| **Testes unitários, E2E ou Casos de Teste (OBI)** | [`.docs/09_TESTING_AND_VERIFICATION.md`](file:///.docs/09_TESTING_AND_VERIFICATION.md) | Vitest, testes E2E offline via CDP Puppeteer, plataforma de maratona (`tests.json`). |
| **Débitos técnicos conhecidos ou roadmap futuro** | [`.docs/10_ROADMAP_AND_DEBT.md`](file:///.docs/10_ROADMAP_AND_DEBT.md) | Histórico de auditorias, bugs sanados, planos de proxy Git CORS, canvas preview. |

---

## 3. Resumo da Estrutura de Diretórios do Projeto

```text
theprog-editor/
├── .docs/                    # 📚 Documentação técnica completa e canônica (leia antes de alterar)
│   ├── INDEX.md              # Índice mestre e sitemap da documentação técnica
│   ├── 01_ARCHITECTURE.md    # Arquitetura de sistemas e concorrência
│   ├── 02_RUNTIMES_AND_EXECUTION.md # Compiladores Wasm e ProcessManager
│   ├── 03_STORAGE_AND_VFS.md # VFS, IndexedDB e File System Access API
│   ├── 04_GIT_SUBSYSTEM.md   # Motor Git client-side em Web Worker
│   ├── 05_UI_AND_COMPONENTS.md # React 19, Monaco Editor, Xterm.js e UI
│   ├── 06_SECURITY_AND_SANDBOXING.md # Sandboxing de código e COOP/COEP
│   ├── 07_OFFLINE_AND_PWA.md # Service Worker e ciclo de vida offline
│   ├── 08_CONVENTIONS_AND_STANDARDS.md # Padrões de código e lições aprendidas
│   ├── 09_TESTING_AND_VERIFICATION.md # Suíte de testes e E2E
│   └── 10_ROADMAP_AND_DEBT.md # Matriz de débitos técnicos e futuro
├── AGENTS.md                 # 🤖 Este manual operacional para Agentes de IA
├── README.md                 # Documentação pública de apresentação do produto
├── CHANGELOG.md              # Histórico formal de mudanças SemVer
├── package.json              # Dependências e scripts npm
├── vite.config.ts            # Build Vite, plugins PWA, code-splitting e headers COOP/COEP
├── public/                   # Assets públicos estáticos e runtimes pré-copiados
│   └── runtimes/             # Pyodide e esbuild copiados no build
└── src/                      # Código-fonte TypeScript/React
    ├── components/           # Componentes UI (layout, modals, common, screens)
    ├── config/               # Versão da aplicação e constantes
    ├── context/              # Contextos globais (EditorContext, ThemeContext, DialogContext)
    ├── hooks/                # Custom hooks (useNetworkStatus, usePwaInstall)
    ├── services/             # Lógica de negócio, runtimes, storage, git, vfs
    │   ├── debugger/         # Gerenciamento de breakpoints
    │   ├── fileTree/         # Algoritmos O(V) de árvore, pathUtils e folder compaction
    │   ├── git/              # GitEngine, GitIdbFs e cliente RPC
    │   ├── languages/        # Registro de linguagens e capacidades de execução
    │   ├── monaco/           # IntelliSense C/C++, Python e TS/JS
    │   ├── process/          # ProcessManager (PIDs, lifecycle, fila FIFO)
    │   ├── runtimes/         # Clang, Python e JS runtime adapters
    │   ├── vfs/              # Virtual File System unificado (VFile)
    │   ├── localFs.ts        # Integração WICG File System Access API
    │   └── storage.ts        # Persistência IndexedDB
    ├── types/                # Definições de tipo (editor.ts, filesystem.d.ts)
    └── workers/              # Web Workers (compiler, wasm, python, js, bundler, git)
```

---

## 4. Guia de Trabalho do Agente Passo a Passo (Protocolo Operacional)

Ao receber uma tarefa do usuário, siga obrigatoriamente este protocolo:

### Passo 1: Localizar e Entender o Domínio
- Identifique quais componentes do sistema são impactados pela solicitação.
- Abra e leia o arquivo correspondente em [`.docs/`](file:///.docs/INDEX.md).
- Verifique se a mudança afeta os invariantes de concorrência (`SharedArrayBuffer`), persistência de arquivos ou isolamento de workers.

### Passo 2: Inspecionar o Código Existente
- Localize os arquivos em `src/` relacionados à tarefa.
- Observe os tipos definidos em `src/types/editor.ts` e `src/types/filesystem.d.ts`.
- Certifique-se de não criar tipos duplicados ou usar `any`.

### Passo 3: Implementar com Respeito à Arquitetura
- Se estiver lidando com execução de código: use sempre o [`ProcessManager`](file:///home/matheus-aguiar/theprog-editor/src/services/process/processManager.ts) e garanta que o cancelamento (`terminate`) funcione em caso de timeout ou `Ctrl+C`.
- Se estiver lidando com manipulação de arquivos: certifique-se de tratar `kind: 'binary'` e `kind: 'too_large'` adequadamente, usando [`VFile`](file:///home/matheus-aguiar/theprog-editor/src/services/vfs/vfs.ts) ou métodos de [`localFs.ts`](file:///home/matheus-aguiar/theprog-editor/src/services/localFs.ts) e [`storage.ts`](file:///home/matheus-aguiar/theprog-editor/src/services/storage.ts).
- Se estiver alterando componentes React: evite efeitos síncronos com `setState` dentro de `useEffect` (regra `react(set-state-in-effect)` do React Compiler).

### Passo 4: Verificar e Validar
Antes de considerar o trabalho concluído, execute:
```bash
# 1. Análise estática de linter (deve permanecer com 0 erros)
npm run lint

# 2. Verificação de compilação TypeScript (tsc)
./node_modules/.bin/tsc -b

# 3. Testes automatizados (quando o ambiente estiver com vitest instalado)
npm test
```

### Passo 5: Atualizar Documentação & Changelog
- Se você adicionar um novo recurso, corrigir um bug estrutural ou alterar contratos de tipos, documente a alteração no documento relevante de [`.docs/`](file:///.docs/INDEX.md) e registre no [`CHANGELOG.md`](file:///home/matheus-aguiar/theprog-editor/CHANGELOG.md).

---

## 5. Comandos e Scripts Úteis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local de desenvolvimento Vite com cabeçalhos COOP/COEP. |
| `npm run build` | Compila o TypeScript (`tsc -b`) e gera o bundle de produção otimizado com chunks vendorizados. |
| `npm run lint` | Executa o linter ultrarrápido `oxlint` sobre toda a base de código. |
| `npm test` | Executa a suíte de testes unitários com `vitest`. |
| `npm run e2e:offline` | Executa o teste de ponta a ponta via Puppeteer com rede desativada para validar PWA offline. |
| `npm run preview` | Serve o diretório `dist/` localmente com cabeçalhos COOP/COEP. |

---

*Com este manual e a suíte em `.docs/`, qualquer agente de IA está plenamente capacitado para entender, manter e expandir o TheProg Editor com máxima fidelidade técnica e zero regressões.*
