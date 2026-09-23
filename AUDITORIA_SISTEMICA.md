# AUDITORIA_SISTEMICA.md — Relatório de Diagnóstico Técnico 360° e Governança de Release

> **Produto:** TheProg Editor  
> **Versão Auditada:** `v0.5.0`  
> **Perfil da Auditoria:** Engenharia Principal, Arquitetura de Sistemas Web e Release Management  
> **Data:** 23 de Setembro de 2026  
> **Status dos Testes:** 55/55 testes aprovados (`npm test`) | 0 erros de lint (`oxlint`)  

---

## 1. Resumo Executivo

O **TheProg Editor** é uma IDE Web PWA client-side com compilação e execução nativas via WebAssembly (Clang/LLVM, Pyodide, esbuild-wasm, Xterm.js e Monaco Editor), servida com isolamento estrito de origem cruzada (`COOP: same-origin` e `COEP: require-corp`) para suporte a `SharedArrayBuffer` com sincronização síncrona de I/O via `Atomics`.

Após uma sequência abrangente de implementações recentes (incluindo o novo `ProcessManager` com controle formal de PIDs, o sistema de arquivos virtual `VFile`, o explorador de arquivos de alta performance *File Explorer 2.0* e o subsistema experimental de Controle de Versão Git local 100% offline), foi executada uma **auditoria sistêmica 360°** cobrindo funcionalidade, engenharia de software, contratos de tipo, bundle size, precache offline e governança de release conforme SemVer 2.0.

### Principais Conclusões:
1. **Estabilidade Funcional Elevada:** Os pipelines de compilação e execução isolada em Web Workers operam com resiliência; o encerramento forçado via `worker.terminate()` e as flags de interrupção em `SharedArrayBuffer` desarmam loops infinitos (`SIGINT`/`Ctrl+C`) com segurança comprovada.
2. **Gargalo Crítico de Bundle (5.24 MB em chunk único):** O arquivo de entrada `dist/assets/index-*.js` concentra 5,24 MB minificados (1,36 MB gzipped) por ausência de *code-splitting* em chunks vendorizados (`monaco-editor`, `@xterm/xterm`, `isomorphic-git`).
3. **Bloat de Precache e Código Órfão:** Identificada a presença da dependência não utilizada `coi-serviceworker` e do pacote legado `v86` com um binário inativo em `public/v86/v86.wasm` de **2.10 MB**, consumindo cota desnecessária de precache no Service Worker.
4. **Tipagem e Contratos:** A File System Access API depende de casts permissivos (`as any`) por falta de tipagens ambientais WICG; o Monaco Editor possui referências em `useRef<any>` que podem ser estritamente tipadas.
5. **Parecer de Promoção de Versão:** Diante das massivas adições de novos subsistemas sem quebras destrutivas de compatibilidade e da presença do Git sob flag experimental (`enableGitExperimental: false`), a recomendação técnica primária é o salto formal para **`v0.6.0`** (ou **`v1.0.0`** como marco de maturidade de produto).

---

## 2. Matriz de Débitos Técnicos e Riscos Críticos

| # | Severidade | Componente | Problema Diagnosticado | Impacto no Produto |
|:---:|:---:|:---|:---|:---|
| **1** | **ALTO** | `vite.config.ts` / Build | Ausência de `manualChunks` gerando chunk monolítico de **5.24 MB** (`index-*.js`). | TTI elevado, lentidão no primeiro carregamento e invalidação completa do cache a cada pequena alteração de código. |
| **2** | **MÉDIO** | `package.json` / `public/v86/` | Binário órfão `v86.wasm` (**2.10 MB**) e dependência não utilizada `v86` mantidos em precache. | Desperdício de 2.1 MB de armazenamento local/dados no primeiro acesso e poluição de manifesto Workbox. |
| **3** | **MÉDIO** | `package.json` | Dependência `coi-serviceworker` listada mas sem qualquer uso no código. | Dependência fantasma gerando overhead no `package-lock.json` e risco de confusão na manutenção. |
| **4** | **MÉDIO** | `src/services/localFs.ts` | Uso de `(window as any).showDirectoryPicker` e `(handle as any).values()` por ausência de tipos WICG. | Fragilidade de tipagem TypeScript e perda de autocomplete estrito nas APIs de disco nativo. |
| **5** | **BAIXO** | `src/components/layout/EditorArea.tsx` | Referência do Monaco `editorRef = useRef<any>(null)` e casts frouxos. | Risco de runtime error não detectado em tempo de compilação em operações no editor. |
| **6** | **BAIXO** | `src/components/layout/EditorArea.tsx` | Efeito síncrono `setForcedText(null)` disparado no hook de alteração de arquivo (`activeFileId`). | Alerta de `react(set-state-in-effect)` no React Compiler com risco de renderizações em cascata desnecessárias. |
| **7** | **BAIXO** | Documentação (`README.md`) | `README.md` desatualizado, sem documentar ProcessManager, File Explorer 2.0, Test Runner, Snippets e Git. | Discrepância grave entre a capacidade real do produto e a documentação pública do repositório. |

---

## 3. Diagnóstico Detalhado por Dimensões

### 3.1 Conformidade de Produto e Estabilidade Funcional

#### Multi-runtime e Isolamento de Workers
- **C/C++ (Clang/WASI):** O compilador YoWASP Clang opera isolado em `compilerWorker.ts` e o executável gerado roda em `wasmWorker.ts` sob a especificação WASI (`@bjorn3/browser_wasi_shim`).
- **Sincronização de Entrada (Atomics/SAB):** Para `scanf()`, `cin` e chamadas bloqueantes, o worker pausa sincronicamente em `Atomics.wait(control, 0, 0)` em um `SharedArrayBuffer` de 64 KB.
- **Resiliência a Loops Infinitos:** Quando o usuário clica em parar ou pressiona `Ctrl+C` (`\x03`), o `ProcessManager` aciona `proc.controller.abort()`, que grava `-1` no buffer Atomics e chama `Atomics.notify()`. Caso o código Wasm esteja preso em loop puramente aritmético sem I/O (`while(1){}`), a função de limpeza executa `worker.terminate()`, destruindo o thread nativo imediatamente sem congelar a UI.
- **Python (Pyodide):** O worker `pythonWorker.ts` implementa buffer de interrupção nativo com `pyodide.setInterruptBuffer()`. Ao acionar o cancelamento, a flag `interrupt[0] = 2` injeta `KeyboardInterrupt` no interpretador CPython. Se houver travamento em extensão C que não responda em 1.500 ms, o `pythonRuntime` descarta e recria o worker de forma limpa.
- **JavaScript/TypeScript (esbuild-wasm + Worker):** A execução em `jsWorker.ts` conta com a função `sanitizeGlobalScope()`, que revoga o acesso a `indexedDB`, `caches`, `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker` e `BroadcastChannel`, impedindo que códigos executados violem a segurança do navegador ou manipulem storages de outros workspaces.

#### Integridade do Virtual FS e Storage
- **Versionamento do IndexedDB:** O banco `theprog-editor-db` está na versão `4` com as *objectStores* `files`, `settings`, `vmCache` e `git_fs`.
- **Proteção de Integridade:**
  - Arquivos com tamanho superior a 5 MB no disco local são marcados como `kind: 'too_large'` e travados como somente-leitura, eliminando o risco de truncamento destrutivo do arquivo físico no SO.
  - Arquivos binários (imagens, WASM, bancos SQLite) utilizam `kind: 'binary'` e manipulação direta de `Uint8Array`, sem conversão espúria para strings UTF-8.
  - O mecanismo `recordInternalWrite` em `localFs.ts` evita laços de sincronização infinita quando o navegador detecta alterações geradas pelo próprio editor.

#### PWA e Ciclo de Vida Offline
- O arquivo `src/sw.ts` utiliza `precacheAndRoute(self.__WB_MANIFEST)` do Workbox com injeção manual de manifest.
- O plugin `coopCoepPlugin` assegura que todas as respostas retornadas pelo Service Worker contenham os cabeçalhos obrigatórios:
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp`
  - `Cross-Origin-Resource-Policy: cross-origin`
- O handler de navegação SPA (`NavigationRoute`) intercepta requisições ao `index.html` e possui fallback de contingência caso o dispositivo esteja desconectado.
- Estratégias `CacheFirst` dedicadas protegem pacotes `.whl` do Python, binários `.wasm`, fontes e assets estáticos.

---

### 3.2 Engenharia de Software e Qualidade de Código

#### Tipagem e Contratos TypeScript
- **Casts `as any` em APIs Web Modernas:**
  - Em `src/services/localFs.ts`, o uso recorrente de `(window as any).showDirectoryPicker` e `(dirHandle as any).values()` ocorre porque a biblioteca padrão de tipos do TypeScript para DOM não inclui a especificação WICG File System Access API por padrão.
  - *Ação corretiva:* Criar o arquivo de declaração de tipos ambientais `src/types/filesystem.d.ts` formalizando a interface WICG e eliminando todos os casts arbitrários.
- **Referências ao Monaco Editor:**
  - Em `EditorArea.tsx`, `editorRef` está tipado como `useRef<any>(null)`.
  - *Ação corretiva:* Tipar com `useRef<monaco.editor.IStandaloneCodeEditor | null>(null)` e tipar instâncias do diff editor com `monaco.editor.IStandaloneDiffEditor`.

#### Performance de Renderização (React 19)
- **Árvore de Arquivos (Sidebar):** A memoização estrutural através de `buildDirectoryIndex` e a linearização em `getVisibleLinearNodes` garantem complexidade $O(V)$ onde $V$ é o número de nós visíveis no viewport, dispensando virtualizadores pesados de terceiros e mantendo o DOM extremamente enxuto.
- **Terminais Xterm.js:** Os terminais são desacoplados do ciclo de vida reativo do React; as saídas de texto são transmitidas via subscrição de eventos diretos (`subscribeExecutionOutput`), evitando disparar re-renderizações na casca da IDE durante execuções de alta taxa de I/O.
- **Efeitos Colaterais no React Compiler:** No `EditorArea.tsx`, a chamada `setForcedText(null)` dentro de um `useEffect` vinculado a `activeFileId` dispara um alerta de render em cascata. O estado pode ser derivado ou redefinido de forma desacoplada.

---

### 3.3 Auditoria de Bundle e Otimização de Assets

#### O Gargalo do Chunk Monolítico
Na configuração atual do Vite, o build de produção empacota praticamente todas as bibliotecas no arquivo `dist/assets/index-f97O8wri.js`, resultando em:
- **Tamanho Total do Chunk Principal:** **5.245,34 kB** (1.362,39 kB gzipped).
- **Alerta emitido pelo Vite/Rolldown:** `(!) Some chunks are larger than 500 kB after minification.`

**Composição do Gargalo:**
1. `monaco-editor` e `@monaco-editor/react`: ~3.5 MB
2. `@xterm/xterm` e addons de terminal: ~400 KB
3. `isomorphic-git`: ~450 KB
4. Ícones `lucide-react` e utilitários: ~250 KB
5. Código da aplicação TheProg: ~300 KB

#### Solução Arquitetural de Code-Splitting
Configurar `build.rollupOptions.output.manualChunks` no `vite.config.ts`:
```typescript
build: {
  chunkSizeWarningLimit: 1500,
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-monaco': ['monaco-editor', '@monaco-editor/react'],
        'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links'],
        'vendor-git': ['isomorphic-git'],
        'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
      },
    },
  },
}
```

#### Limpeza de Dependências Órfãs e Assets Fantasmas
1. **Remoção de `coi-serviceworker`:** A biblioteca `coi-serviceworker` está declarada em `dependencies` no `package.json`, porém não é importada em nenhum arquivo do projeto, pois o `sw.ts` já implementa `coopCoepPlugin`.
2. **Remoção de `v86`:** O emulador x86 `v86` era utilizado em versões arcaicas de protótipo e foi 100% substituído por Clang/WASI. Permanece no `package.json`, em `includeAssets` do `vite.config.ts` e na pasta `public/v86` (arquivo `v86.wasm` de **2.101.621 bytes**). A exclusão deste diretório e dependência elimina mais de 2.1 MB de download e precache offline imediatamente.

---

## 4. Oportunidades Imediatas de Otimização e Ganhos Quantificados

| Métrica / Recurso | Estado Atual (`v0.5.0`) | Estado Otimizado Proposto | Ganho / Benefício |
|:---|:---:|:---:|:---|
| **Chunk Principal (`index.js`)** | 5.245 kB (5,24 MB) | **~350 kB** | **-93% de redução** no script inicial da aplicação |
| **Chunk Monaco Editor** | Embutido no `index.js` | 3.520 kB (`vendor-monaco.js`) | Cache isolado; não rebaixa em updates de código |
| **Chunk Xterm Console** | Embutido no `index.js` | 380 kB (`vendor-xterm.js`) | Cache isolado por longo prazo |
| **Chunk Git Local** | Embutido no `index.js` | 440 kB (`vendor-git.js`) | Cache isolado |
| **Precache PWA Inicial** | 150.454 KiB (143 assets) | **~148.350 KiB (141 assets)** | **-2.10 MB eliminados** pela remoção do `v86.wasm` |
| **Dependências Órfãs** | 2 (`coi-serviceworker`, `v86`) | **0** | `package.json` enxuto e seguro |
| **Tipagem `as any` em FileSystem** | Presente em 12 pontos | **0** (`src/types/filesystem.d.ts`) | Rigor e integridade estrita de tipagem TypeScript |

---

## 5. Parecer Justificado de Promoção de Versão (SemVer 2.0)

A especificação do **Semantic Versioning 2.0.0** estipula:
- **Formato:** `MAJOR.MINOR.PATCH`
- No ciclo pré-1.0 (`0.y.z`), a versão menor `y` é incrementada para refletir adições substanciais de novas funcionalidades (*feature releases*) ou refinamentos estruturais significativos.
- A versão `1.0.0` define o marco de estabilidade formal da API pública e maturidade de produto.

### Análise Comparativa do Salto de Versão:

#### Opção A: Promoção para `v0.6.0` (Recomendação Técnica Primária)
- **Justificativa:**
  - O volume de novas capacidades introduzidas desde o `v0.5.0` é expressivo:
    1. Novo subsistema `ProcessManager` com controle atômico de concorrência e buffer FIFO de stdin;
    2. Suporte a compilação multi-arquivo declarativa (`.theprog/project.json`);
    3. Painel automatizado de Casos de Teste (estilo OBI/Beecrowd/LeetCode);
    4. Catálogo didático de snippets de algoritmos e estruturas de dados;
    5. Split View (edição simultânea de abas lado a lado);
    6. Pré-visualização em tempo real de Markdown;
    7. Explorador de Arquivos 2.0 com indexação em tempo linear, compactação de pastas, criação com caminhos aninhados e navegação WAI-ARIA;
    8. Subsistema experimental de Git local offline.
  - A funcionalidade Git foi introduzida explicitamente sob a flag `enableGitExperimental: false` (desativada por padrão). Manter a versão em `0.6.0` adere rigorosamente à boa prática de engenharia de software de estabilizar recursos experimentais em ambiente de campo antes de declarar o marco definitivo `1.0.0`.

#### Opção B: Promoção para `v1.0.0` (Marco de Maturidade de Produto)
- **Justificativa Alternativa:**
  - Caso o comitê de release decida que o conjunto funcional atingiu a plenitude de uma IDE completa e independente para uso pedagógico e profissional, o salto para `v1.0.0` pode ser justificado como o primeiro release estável do TheProg Editor.

### 📌 Recomendação Técnica do Release Manager
Recomenda-se formalmente a promoção para **`v0.6.0`**, consolidando este marco com changelog estruturado e documentação integralmente alinhada.

#### Fontes da Verdade a Sincronizar:
1. `package.json` (`"version": "0.6.0"`)
2. `package-lock.json` (`"version": "0.6.0"`)
3. `src/config/version.ts` (`export const APP_VERSION = '0.6.0';`)
4. Manifest PWA e cabeçalhos de título
5. `README.md` (badges, título e árvore de arquitetura)
6. `CHANGELOG.md` (criação formal da versão `v0.6.0`)

---

## 6. Plano de Ação das Etapas Subsequentes

Após a aprovação deste relatório pelo usuário, serão executadas imediatamente as etapas hands-on:

### Etapa 2: Refinamento de Código (Hands-on)
1. **Otimização de Build & Chunks:**
   - Adicionar configuração de `manualChunks` e `chunkSizeWarningLimit` no `vite.config.ts`.
2. **Purga de Dependências e Assets Órfãos:**
   - Remover `coi-serviceworker` e `v86` do `package.json` e `vite.config.ts`.
   - Excluir o diretório `public/v86/` (removendo o binário inativo de 2.1 MB).
3. **Reforço de Tipos e Contratos:**
   - Criar `src/types/filesystem.d.ts` para tipar estritamente a WICG File System Access API.
   - Refinar os casts em `src/services/localFs.ts` e tipar referências do Monaco em `EditorArea.tsx`.
4. **Resolução de Warnings de Renderização:**
   - Ajustar o efeito em `EditorArea.tsx` para eliminar o alerta `react(set-state-in-effect)`.

### Etapa 3: Sincronização de Versão
- Atualizar versão para `0.6.0` em `package.json`, `package-lock.json` e `src/config/version.ts`.
- Validar `npm run lint`, `npm test` e `npm run build`.

### Etapa 4: Atualização Completa da Documentação
- Criar `CHANGELOG.md` no padrão *Keep a Changelog* categorizando *Added*, *Changed*, *Fixed* e *Performance*.
- Atualizar completamente o `README.md` incorporando todos os recursos implementados (File Explorer 2.0, ProcessManager, Test Runner, Snippets Library, Split View, Markdown Preview e Git Experimental).

---

*Relatório elaborado conforme as diretrizes de Auditoria 360° do TheProg Editor.*
