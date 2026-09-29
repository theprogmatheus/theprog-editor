# 📚 Índice Mestre da Documentação Técnica (`.docs/`)

> **TheProg Editor — Arquitetura de Sistemas WebAssembly e Engenharia Client-Side**  
> *Versão Canônica da Documentação: `v0.6.0`*

Bem-vindo ao repositório canônico de documentação do **TheProg Editor**.  
Este conjunto de documentos foi projetado para servir como base de conhecimento exaustiva tanto para engenheiros de software quanto para **Agentes de IA autônomos** (conforme descrito em [`AGENTS.md`](file:///AGENTS.md)).

---

## 🧭 Mapa Estruturado dos Documentos

```text
.docs/
├── INDEX.md                     # Este índice mestre e sitemap estruturado
├── 01_ARCHITECTURE.md           # Visão sistêmica, concorrência, workers e fluxo de dados
├── 02_RUNTIMES_AND_EXECUTION.md # Compiladores WebAssembly, ProcessManager e ciclos de vida
├── 03_STORAGE_AND_VFS.md        # VFS, IndexedDB, File System Access API e árvore O(V)
├── 04_GIT_SUBSYSTEM.md          # Controle de versão Git client-side em Web Worker
├── 05_UI_AND_COMPONENTS.md      # React 19, Monaco Editor, Xterm.js, Split View e Modals
├── 06_SECURITY_AND_SANDBOXING.md# Cabeçalhos COOP/COEP, SharedArrayBuffer e sandbox JS
├── 07_OFFLINE_AND_PWA.md        # Service Worker Workbox, precache e estratégia offline
├── 08_CONVENTIONS_AND_STANDARDS.md # TypeScript estrito, linter oxlint e lições aprendidas
├── 09_TESTING_AND_VERIFICATION.md # Vitest, testes E2E offline e runner de problemas OBI
└── 10_ROADMAP_AND_DEBT.md       # Matriz de riscos históricos sanados e roadmap futuro
```

---

## 📖 Resumo Executivo por Documento

### 1. [01_ARCHITECTURE.md](01_ARCHITECTURE.md)
- **Foco:** Arquitetura em camadas da aplicação, modelo multi-threading com Web Workers e sincronização via `SharedArrayBuffer` / `Atomics`.
- **Conteúdo Principal:** Diagrama de fluxo de execução ponta a ponta, papéis da UI thread e dos workers secundários, modelo determinístico de mensagens e isolamento de falhas.

### 2. [02_RUNTIMES_AND_EXECUTION.md](02_RUNTIMES_AND_EXECUTION.md)
- **Foco:** Motores de execução para C, C++, Python, JavaScript e TypeScript.
- **Conteúdo Principal:** Detalhes de compilação YoWASP Clang/LLVM, runner WASI (`@bjorn3/browser_wasi_shim`), CPython Pyodide, empacotamento com `esbuild-wasm`, máquina de estados do [`ProcessManager`](file:///src/services/process/processManager.ts), controle de PIDs monotônicos, fila FIFO de `stdin` e cancelamento atômico instantâneo (`Ctrl+C` / `terminate`).

### 3. [03_STORAGE_AND_VFS.md](03_STORAGE_AND_VFS.md)
- **Foco:** Camada de persistência dual e sistema de arquivos virtual.
- **Conteúdo Principal:** Abstração [`VFile`](file:///src/services/vfs/vfs.ts), banco de dados IndexedDB (`theprog-editor-db` v4), integração WICG File System Access API ([`localFs.ts`](file:///src/services/localFs.ts)), proteção contra destruição de arquivos $>5\text{ MB}$ (`kind: 'too_large'`), preservação de binários sem conversão UTF-8 e indexação linear de árvore $O(V)$ com compactação de pastas ([`treeIndex.ts`](file:///src/services/fileTree/treeIndex.ts)).

### 4. [04_GIT_SUBSYSTEM.md](04_GIT_SUBSYSTEM.md)
- **Foco:** Controle de versão local offline no navegador.
- **Conteúdo Principal:** Motor [`GitEngine`](file:///src/services/git/gitEngine.ts) e filesystem IndexedDB [`GitIdbFs`](file:///src/services/git/gitEngine.ts), isolamento em [`gitWorker.ts`](file:///src/workers/gitWorker.ts), protocolo RPC, área de staging/unstaging, criação e alternância de branches, integração com Monaco DiffEditor e arquitetura planejada para proxy CORS de operações remotas (`clone`, `pull`, `push`).

### 5. [05_UI_AND_COMPONENTS.md](05_UI_AND_COMPONENTS.md)
- **Foco:** Engenharia de interface e produtividade do desenvolvedor.
- **Conteúdo Principal:** Componentes React 19 desacoplados da reatividade pesada de I/O, integração com Monaco Editor, sistema de abas com modo Preview vs Pin, Split View horizontal/vertical, console tripartite com Xterm.js ([`TerminalPanel.tsx`](file:///src/components/layout/TerminalPanel.tsx)), contexto de estado global [`EditorContext.tsx`](file:///src/context/EditorContext.tsx) e regras de prevenção de cascading re-renders no React Compiler.

### 6. [06_SECURITY_AND_SANDBOXING.md](06_SECURITY_AND_SANDBOXING.md)
- **Foco:** Defesa em profundidade, isolamento de origem e privacidade.
- **Conteúdo Principal:** Cabeçalhos `COOP: same-origin` e `COEP: require-corp`, impacto de `SharedArrayBuffer`, esterilização do escopo global em scripts JS de usuário ([`sanitizeGlobalScope`](file:///src/workers/jsWorker.ts)), modelo de permissões do navegador para o disco físico e garantia de zero vazamento de credenciais.

### 7. [07_OFFLINE_AND_PWA.md](07_OFFLINE_AND_PWA.md)
- **Foco:** Ciclo de vida PWA e independência total de conexão.
- **Conteúdo Principal:** Configuração Workbox no Service Worker ([`src/sw.ts`](file:///src/sw.ts)), injeção de manifest, estratégias de particionamento de cache (`CacheFirst` para wheels e WASM), injeção dinâmica de cabeçalhos COOP/COEP pelo Service Worker e lazy loading de runtimes pesados para arranque sub-segundo.

### 8. [08_CONVENTIONS_AND_STANDARDS.md](08_CONVENTIONS_AND_STANDARDS.md)
- **Foco:** Padrões de código, tipagem TypeScript e governança.
- **Conteúdo Principal:** Tolerância zero para `as any` sem tipagem ambiental correspondente, regras do linter `oxlint`, catálogo de armadilhas históricas e lições consolidadas do [`A_CORRIGIR.md`](file:///A_CORRIGIR.md), padrão de commits convencionais e regras SemVer 2.0.

### 9. [09_TESTING_AND_VERIFICATION.md](09_TESTING_AND_VERIFICATION.md)
- **Foco:** Qualidade de software, testes automatizados e ferramenta de maratona.
- **Conteúdo Principal:** Execução de testes unitários com Vitest, testes E2E offline automatizados via Puppeteer e protocolo CDP ([`e2e-offline.mjs`](file:///scripts/e2e-offline.mjs)), runner de casos de teste estilo OBI/LeetCode ([`TestRunnerPanel.tsx`](file:///src/components/layout/TestRunnerPanel.tsx)) com cálculo de vereditos (AC, WA, TLE, RE).

### 10. [10_ROADMAP_AND_DEBT.md](010_ROADMAP_AND_DEBT.md)
- **Foco:** Histórico de auditoria, débitos técnicos resolvidos e evolução futura.
- **Conteúdo Principal:** Resumo da auditoria sistêmica 360°, tabela de todos os 29 problemas corrigidos da versão `v0.5.0` para `v0.6.0`, roadmap de evolução para proxy CORS de Git remoto, prévia de gráficos Canvas e depurador visual passo-a-passo.

---

## 🎯 Como Contribuir ou Fazer Alterações Usando a Documentação

1. **Antes de codificar:** Consulte o roteador de tarefas em [`AGENTS.md`](file:///AGENTS.md) e abra o documento técnico relevante da lista acima.
2. **Durante o desenvolvimento:** Respeite rigorosamente as convenções de tipagem e isolamento documentadas em [08_CONVENTIONS_AND_STANDARDS.md](08_CONVENTIONS_AND_STANDARDS.md).
3. **Após implementar:** Atualize a seção pertinente do documento técnico correspondente e registre sua alteração em [`CHANGELOG.md`](file:///CHANGELOG.md).
