# A_CORRIGIR.md — Relatório Técnico Consolidado de Auditoria de Sistemas

Auditoria exaustiva da base de código do **TheProg Editor** focada em falhas silenciosas, vulnerabilidades de segurança, corrupção de concorrência, integridade de dados e vazamentos de recursos em produção.

- **Data da Auditoria:** 2026-09-22
- **Versão Avaliada:** `0.5.0`
- **Padrão de Severidade:** Engenharia Principal e Auditoria de Sistemas (Tolerância Zero para perda de dados e deadlocks)
- **Status do Build & Testes:** `npm test` → 23/23 testes passando; `npm run lint` → 0 erros (10 warnings).

---

## 📊 Matriz Consolidada de Riscos e Falhas

| # | Gravidade | Título Direto do Bug | Arquivo Principal | Linhas | Status |
|---|-----------|----------------------|-------------------|--------|--------|
| 1 | **CRÍTICO** | Sobrescrita e Destruição Irreversível de Arquivos > 5MB no Disco | `src/services/localFs.ts` / `src/context/EditorContext.tsx` | `:147-160`, `:903-951` | [ ] |
| 2 | **CRÍTICO** | Corrupção de Arquivos Binários Gerados em WASI/Python via UTF-8 | `src/context/EditorContext.tsx` | `:1258-1340` | [ ] |
| 3 | **CRÍTICO** | Travamento Permanente (Hang Infinito e Leak) ao Interromper WASI | `src/services/cCompiler.ts` / `src/services/runtimes/clangRuntime.ts` | `:370-452`, `:85-93` | [ ] |
| 4 | **CRÍTICO** | Corrida de Execução no `vmManager`: Ausência de Token/Epoch | `src/services/vmManager.ts` | `:115-132`, `:205-267` | [ ] |
| 5 | **CRÍTICO** | Deadlock no Worker Python e Roteamento Incorreto de Mensagens | `src/services/runtimes/pythonRuntime.ts` / `src/workers/pythonWorker.ts` | `:138-174`, `:216-292` | [ ] |
| 6 | **CRÍTICO** | Alocação Incondicional de `SharedArrayBuffer` sem Suporte a COOP/COEP | `src/services/runtimes/pythonRuntime.ts` / `src/services/runtimes/jsRuntime.ts` | `:294`, `:203` | [ ] |
| 7 | **ALTO** | Corrida na Persistência de Wheels Python Quebrando Uso Offline | `src/services/pythonPackages.ts` / `src/workers/pythonWorker.ts` | `:67-98`, `:294-336` | [ ] |
| 8 | **ALTO** | Perda de Entrada em Digitação Rápida ou Paste Multilinha (SAB/Atomics) | `src/services/vmManager.ts` / `src/services/runtimes/pythonRuntime.ts` | `:160-173`, `:312-320` | [ ] |
| 9 | **ALTO** | Escopo Reduzido em `getFilesInProjectScope` Quebra Módulos e Includes | `src/context/EditorContext.tsx` | `:1163-1181`, `:1224-1246` | [ ] |
| 10 | **ALTO** | Bloqueio Total da Aplicação (App Brick/DoS) em Falha do Clang | `src/App.tsx` / `src/context/EditorContext.tsx` | `:86-95`, `:1135-1140` | [ ] |
| 11 | **ALTO** | Auto-Sync Sobrescreve Edições Ativas do Usuário em Arquivos Externos | `src/context/EditorContext.tsx` | `:758-787` | [ ] |
| 12 | **ALTO** | Gravações Fire-and-Forget Limpam `isDirty` Mesmo em Falha | `src/context/EditorContext.tsx` / `src/services/localFs.ts` | `:943-963`, `:190-214` | [ ] |
| 13 | **ALTO** | `moveFileItem` usa `move()` de 1 Argumento e Viola Unique Index no IDB | `src/context/EditorContext.tsx` / `src/services/localFs.ts` / `storage.ts` | `:1407-1456`, `:291-344`, `:92` | [ ] |
| 14 | **ALTO** | Encerramento Prematuro de Código Assíncrono no Worker JS/TS | `src/workers/jsWorker.ts` / `src/services/runtimes/jsRuntime.ts` | `:106-112`, `:264-274` | [ ] |
| 15 | **ALTO** | Auto-Sync Remove Arquivos Dirty e Trata Scan Parcial como Exclusão | `src/context/EditorContext.tsx` / `src/services/localFs.ts` | `:746-756`, `:357-409` | [ ] |
| 16 | **ALTO** | `openDB` sem Handlers `blocked`/`blocking`/`terminated` Trava Workspace | `src/services/storage.ts` | `:85-110`, `:112-125` | [ ] |
| 17 | **ALTO** | Poluição Persistente de `sys.modules` no Python Impede Atualizações | `src/workers/pythonWorker.ts` | `:227-263` | [ ] |
| 18 | **ALTO** | Download de ZIP do Workspace Trunca Todos os Binários para 0 Bytes | `src/context/EditorContext.tsx` | `:611-632` | [ ] |
| 19 | **ALTO** | Duplicação de Cache e Estouro de Quota de Armazenamento no PWA | `src/sw.ts` / `vite.config.ts` | `:35, :72-130`, `:94-99` | [ ] |
| 20 | **ALTO** | Memory Leak Progressivo no Monaco por Acúmulo de `addExtraLib` | `src/services/monaco/tsLanguageService.ts` | `:56-70` | [ ] |
| 21 | **MÉDIO** | Cache de Compilação C/C++ Ilimitado com Risco de OOM na Aba | `src/services/cCompiler.ts` | `:227-250`, `:329-332` | [ ] |
| 22 | **MÉDIO** | `pythonRuntime.pending` sem Timeout e sem Rejeição em Erro do Worker | `src/services/runtimes/pythonRuntime.ts` | `:42`, `:77-88`, `:360-401` | [ ] |
| 23 | **MÉDIO** | Análise Semântica de C/C++ Síncrona na Thread de UI no Monaco | `src/services/monaco/cLanguageService.ts` | `:325-327`, `:860`, `:1076` | [ ] |
| 24 | **MÉDIO** | Fechamento de Aba ou Navegação sem Confirmação de Conteúdo Dirty | `src/context/EditorContext.tsx` | `:873-891` | [ ] |
| 25 | **MÉDIO** | Identidade de Workspace Local Baseada Exclusivamente no Nome da Pasta | `src/context/EditorContext.tsx` | `:319-320`, `:391-398`, `:805` | [ ] |
| 26 | **BAIXO** | Efeitos Colaterais Impuros dentro de Updaters React `setFiles` | `src/context/EditorContext.tsx` | `:943-957`, `:1260-1343` | [ ] |
| 27 | **BAIXO** | Mascaramento Indevido de Alterações por `recordInternalWrite` Prévio | `src/services/localFs.ts` | `:198`, `:213` | [ ] |
| 28 | **BAIXO** | Ausência de Sanitização de Caracteres Especiais em `createNewFile` | `src/context/EditorContext.tsx` / `Sidebar.tsx` | `:968-1050`, `:160-166` | [ ] |
| 29 | **BAIXO** | Truncamento Rígido de Entradas no Terminal a 65.520 Bytes | `src/workers/wasmWorker.ts` / `src/workers/jsWorker.ts` | `:126-137`, `:165-171` | [ ] |

---

## 🔴 SEVERIDADE CRÍTICA

### 1. [CRÍTICO] Sobrescrita e Destruição Irreversível de Arquivos > 5MB no Disco Local do Usuário
- **Localização:** `src/services/localFs.ts:147-160` (`readDirectoryTree`), `src/context/EditorContext.tsx:903-907` (`saveActiveFile`) e `src/context/EditorContext.tsx:948-951` (auto-save).
- **Mecanismo da Falha:** Em `readDirectoryTree`, arquivos no disco local com tamanho superior a 5MB e cuja extensão não seja binária conhecida recebem:
  ```typescript
  content = kind === 'text' ? '/* Arquivo muito grande para exibição inline (> 5MB) */' : undefined;
  ```
  Como `isTextFileKind(activeFile.kind)` retorna `true`, o Monaco exibe esse aviso textual na área de edição. Quando o temporizador de `autoSave` (1500ms) expira ou o desenvolvedor aciona `Ctrl+S`, `saveFileToDisk` recebe esse placeholder e o grava fisicamente no sistema operacional, truncando arquivos reais de vários megabytes para uma única linha de texto.
- **Impacto em Produção:** Perda catastrófica e permanente de dados no disco físico do usuário (códigos extensos, datasets, dumps SQL, logs e arquivos de dados).
- **Correção Recomendada:**
  1. Definir o tipo `kind = 'too_large'` para arquivos acima do teto de leitura.
  2. Travar o Monaco como estritamente `readOnly`.
  3. No `saveActiveFile` e no `autoSave`, abortar a escrita se `activeFile.kind === 'too_large'`.

---

### 2. [CRÍTICO] Corrupção Silenciosa de Arquivos Binários Gerados em WASI/Python via Decodificação UTF-8
- **Localização:** `src/context/EditorContext.tsx:1258-1340` (rotina `handleFilesUpdated` em `runActiveFile`).
- **Mecanismo da Falha:** Quando binários compilados em WASI ou scripts Python gravam arquivos durante a execução, o worker repassa os dados brutos (`data: Uint8Array`). O manipulador `handleFilesUpdated` aplica incondicionalmente:
  ```typescript
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const decodedContent = decoder.decode(synced.data);
  ```
  Bytes que violam a gramática UTF-8 são corrompidos com o caractere `\uFFFD`. Em seguida, o código persiste `f.content` (uma string irremediavelmente corrompida) no disco através de `saveFileToDisk(handle, f.path, f.content || '')`.
- **Impacto em Produção:** Qualquer programa que gere arquivos binários (imagens com OpenCV/Pillow, bancos SQLite gerados por código, compactação zlib, saídas compiladas) corrompe o arquivo tanto no workspace em memória quanto no disco físico.
- **Correção Recomendada:**
  Manter o `Uint8Array` nos dados sincronizados. Executar `detectFileKindFromBytes(synced.data)` e repassar o buffer binário diretamente para `saveFileToDisk` (que já suporta `string | Uint8Array`), persistindo como string apenas se o arquivo for genuinamente texto.

---

### 3. [CRÍTICO] Travamento Permanente (Hang Infinito e Leak) ao Interromper Binários C/C++
- **Localização:** `src/services/cCompiler.ts:370-452` (`executeWasmBinary`) e `src/services/runtimes/clangRuntime.ts:85-93`. *(Anteriormente catalogado como Médio, elevado para Crítico pelo impacto de deadlock e leak).*
- **Mecanismo da Falha:** `executeWasmBinary` encapsula a execução do worker em uma `Promise<number>`. Ao clicar no botão de interrupção ou pressionar `Ctrl+C`, `stopExecution()` invoca `controller.abort()`, que executa `cleanup()`, chamando `worker.terminate()`. Como a finalização via `Worker.terminate()` não emite mensagens nem eventos de erro no worker encerrado, e a Promise interna de `executeWasmBinary` **só invoca `resolve()` nos blocos `onmessage` (`exit`/`error`) e `onerror`**, ela **nunca se estabelece** (`never settles`). O `await executeWasmBinary(...)` no `clangRuntime` e o `await runtimeManager.run(...)` no `vmManager` ficam congelados para sempre.
- **Impacto em Produção:** Vazamento irreversível de dezenas a centenas de megabytes de memória RAM a cada interrupção. O event loop retém todas as closures associadas, e a cadeia assíncrona de execução fica bloqueada permanentemente.
- **Correção Recomendada:**
  Resolver explicitamente a promessa com código `130` (`SIGINT`) no método `abort()` e no `cleanup()`:
  ```typescript
  const cleanup = (exitCode = 130) => {
    if (!isFinished) {
      isFinished = true;
      try { worker.terminate(); } catch {}
      resolve(exitCode);
    }
  };
  ```

---

### 4. [CRÍTICO] Corrida de Execução no `vmManager`: Ausência de Token/Epoch Corrompe Estado Global
- **Localização:** `src/services/vmManager.ts:115-132` (`stopExecution`) e `src/services/vmManager.ts:205-267` (`run`).
- **Mecanismo da Falha:** `vmManager` manipula estado global compartilhado (`isExecuting`, `currentController`, `activeRuntime`). Se o usuário clica em "Interromper" e inicia imediatamente uma nova execução, o método `run()` da Execução B define `this.isExecuting = true` e registra `controllerB`. Quando a Execução A encerra de forma tardia (após timeout ou resolução pendente), seu bloco de finalização executa:
  ```typescript
  this.currentController = null;
  this.activeRuntime = null;
  this.isExecuting = false;
  this.setStatus(exitCode === 0 ? 'ready' : 'error', ...);
  ```
  A Execução A destrói o controlador ativo da Execução B, define falsamente seu status como finalizado e injeta logs de término no terminal no meio da execução legítima do novo processo.
- **Impacto em Produção:** Perda de controle sobre processos ativos, terminal congelado sem aceitar `stdin`, divergência na barra de status da IDE e mistura de saídas de processos distintos.
- **Correção Recomendada:** Implementar geração monotônica de `executionToken`:
  ```typescript
  private currentExecutionToken = 0;

  public async run(plan: RunPlan, options: RunOptions = {}) {
    if (this.isExecuting) this.stopExecution();
    const token = ++this.currentExecutionToken;
    // ...
    try {
      exitCode = await runtimeManager.run(plan.runtime, plan, io);
    } finally {
      if (this.currentExecutionToken !== token) return; // descarta finalização de run zumbi
      this.currentController = null;
      this.activeRuntime = null;
      this.isExecuting = false;
    }
  }
  ```

---

### 5. [CRÍTICO] Deadlock no Worker Python e Roteamento Incorreto de Mensagens sem Validação de ID
- **Localização:** `src/services/runtimes/pythonRuntime.ts:138-174`, `src/services/runtimes/pythonRuntime.ts:309`, `src/services/runtimes/pythonRuntime.ts:343-358`; `src/workers/pythonWorker.ts:216-292`.
- **Mecanismo da Falha:** (1) O run A aguarda entrada em `input()`, bloqueando o worker em `Atomics.wait`. (2) O usuário aciona Run novamente. (3) `stopExecution` aciona `terminate()`, que agenda um `setTimeout` de 1,5s com guarda `if (this.activeRun === run)`. (4) O run B sobrescreve `this.activeRun = runB`. (5) Quando o worker finalmente sai do run A, o handler resolve `this.activeRun` (que é **runB** precocemente). (6) O timeout de 1,5s nota que `this.activeRun !== runA` e não destrói o worker nem conclui o run A. A promise do run A vaza para sempre e as mensagens do run B passam a ser enviadas para um objeto nulo (`this.activeRun?.io`).
- **Impacto em Produção:** Descarte silencioso de saídas e eventos de sincronização de arquivos; congelamento permanente do runtime Python até reload forçado da página.
- **Correção Recomendada:** Rotear mensagens validando rigorosamente `message.id === activeRun.runId`. Em `terminate()`, invocar invariavelmente `run.resolve(130)` e forçar a terminação do worker se `run.terminated` estiver ativo.

---

### 6. [CRÍTICO] Alocação Incondicional de `SharedArrayBuffer` sem Suporte a COOP/COEP Quebra Python e JS
- **Localização:** `src/services/runtimes/pythonRuntime.ts:294, 297` e `src/services/runtimes/jsRuntime.ts:203`.
- **Mecanismo da Falha:** Diferente de `cCompiler.ts` (que possui guards de feature-detection), os adaptadores de Python e JS chamam diretamente `new SharedArrayBuffer(65536)`. Em navegadores que desabilitam cross-origin isolation por padrão ou em provedores de hospedagem sem headers COOP/COEP (como GitHub Pages padrão), `SharedArrayBuffer` é `undefined`. A invocação lança `ReferenceError` síncrono e impede o início dos runtimes.
- **Impacto em Produção:** Impossibilidade absoluta de rodar códigos Python e JavaScript/TypeScript em ambientes sem isolamento de origem ou em navegadores com políticas estritas.
- **Correção Recomendada:**
  Inserir verificação defensiva prévia:
  ```typescript
  const hasSab = typeof SharedArrayBuffer !== 'undefined' && Boolean(window.crossOriginIsolated);
  const sabControl = hasSab ? new SharedArrayBuffer(65536) : null;
  ```
  Implementar fallback via troca assíncrona de mensagens (`postMessage`) ou avisar claramente na interface que a entrada interativa via Atomics exige isolamento de cabeçalhos.

---

## 🟠 SEVERIDADE ALTA

### 7. [ALTO] Condição de Corrida na Gravação do Manifesto de Wheels Python Quebra Uso Offline
- **Localização:** `src/services/pythonPackages.ts:67-98` (`savePythonWheel`) e `src/workers/pythonWorker.ts:294-336`.
- **Mecanismo da Falha:** Durante a instalação de bibliotecas com submódulos ou dependências (ex.: `requests` trazendo `urllib3`, `certifi`, etc.), o worker envia dezenas de mensagens `wheel_installed` em rajada. Cada evento dispara `savePythonWheel` concorrentemente. Todas as chamadas executam `readManifest()`, gravam o arquivo no disco e executam `writeManifest()`. Como as promessas interleavam sem controle de fila, a última escrita sobrescreve o arquivo `manifest.json`, eliminando as dependências registradas pelas chamadas anteriores.
- **Impacto em Produção:** No acesso sem internet, `loadPythonWheels` consulta um manifesto incompleto e falha ao carregar as dependências no Pyodide, gerando `ModuleNotFoundError`.
- **Correção Recomendada:** Serializar as gravações do manifesto através de uma fila encadeada de promessas (Mutex assíncrono).

---

### 8. [ALTO] Perda Silenciosa de Entrada em Digitação Rápida ou Paste Multilinha (SAB/Atomics)
- **Localização:** `src/services/vmManager.ts:160-173`, `src/services/runtimes/pythonRuntime.ts:312-320` e `src/services/cCompiler.ts:403-411`.
- **Mecanismo da Falha:** Ao colar blocos de texto no terminal interativo, `sendInput` itera síncronamente em cada linha:
  ```typescript
  for (const line of lines) {
    this.currentController?.sendStdin(line + '\n');
  }
  ```
  `sendStdin` grava a linha em `data` no `SharedArrayBuffer`, seta `control[0] = 1` e executa `Atomics.notify(control, 0)`. Como o laço roda instantaneamente na thread principal antes que o worker termine de acordar e ler a memória, a iteração seguinte esmaga o buffer com a linha seguinte.
- **Impacto em Produção:** Se o usuário colar 5 linhas de entrada em um programa com múltiplos `scanf()` ou `input()`, apenas a última linha é lida; as 4 primeiras são descartadas silenciosamente.
- **Correção Recomendada:** Criar uma fila FIFO em memória na thread principal. Entregar uma linha por vez e aguardar confirmação do worker (`control[0] === 0`) antes de postar a linha subsequente no SAB.

---

### 9. [ALTO] Escopo Reduzido em `getFilesInProjectScope` Quebra Módulos e Includes Relativos
- **Localização:** `src/context/EditorContext.tsx:1163-1181` e `src/context/EditorContext.tsx:1224-1246`.
- **Mecanismo da Falha:** Quando um arquivo na raiz do workspace é executado (`activeItem.parentId === null`), a função `getFilesInProjectScope` filtra exclusivamente `f.parentId === null`, ignorando sumariamente todos os subdiretórios do projeto.
- **Impacto em Produção:** Qualquer projeto com subpastas (`#include "include/utils.h"` em C ou `from lib.helpers import calc` em Python) falha com erros de compilação ou importação inexistente.
- **Correção Recomendada:** O compilador/runtime deve receber a árvore integral de arquivos do workspace relativos à raiz do projeto.

---

### 10. [ALTO] Bloqueio Total da Aplicação (App Brick/DoS) em Falha de Download do Clang
- **Localização:** `src/App.tsx:86-95` e `src/context/EditorContext.tsx:1135-1140`.
- **Mecanismo da Falha:** O componente `MainApp` bloqueia completamente a renderização da IDE com `LinuxLoadingScreen` enquanto `!isSystemReady`. A flag `isSystemReady` depende obrigatoriamente de `clangProgress?.status === 'ready'`. Se o download dos mais de 100MB do Clang falhar (timeout de rede, bloqueio por proxy, offline no primeiro acesso), a IDE inteira trava em tela de erro irrecuperável.
- **Impacto em Produção:** Negação de serviço total para o usuário, que fica impedido de visualizar seus arquivos ou utilizar os runtimes que já poderiam estar prontos (JS/TS e Python).
- **Correção Recomendada:** Permitir a inicialização do editor independentemente do status dos compiladores. Falhas nos runtimes devem apenas desabilitar a ação "Compilar & Executar" da linguagem em questão.

---

### 11. [ALTO] Auto-Sync Sobrescreve Edições Ativas do Usuário em Arquivos Externos
- **Localização:** `src/context/EditorContext.tsx:758-787`.
- **Mecanismo da Falha:** O polling de auto-sync (`scanDirectorySnapshot`) compara o timestamp do disco com o do editor. Se houver discrepância e a aba não estiver `isDirty` no instante do check, ele dispara `getFileHandleByPath(...).then(...)`. Se o usuário começar a digitar durante esse intervalo assíncrono, a promise resolve e executa `setFiles` incondicionalmente, sobrepondo o texto digitado pelo conteúdo antigo lido do disco.
- **Impacto em Produção:** Trechos de código recém-digitados somem subitamente da tela.
- **Correção Recomendada:** No callback de atualização, checar se a aba tornou-se `isDirty` ou se o arquivo sofreu alterações locais antes de aplicar o novo conteúdo.

---

### 12. [ALTO] Gravações Fire-and-Forget Limpam `isDirty` Mesmo em Falha
- **Localização:** `src/context/EditorContext.tsx:943-963`, `src/context/EditorContext.tsx:905-915` e `src/services/localFs.ts:190-214`.
- **Mecanismo da Falha:** O timer de `autoSave` chama `saveFileToDisk` ou `saveFileToStorage` sem `await` e executa imediatamente `setTabs((prev) => prev.map(t => ({ ...t, isDirty: false })))`. Se a gravação no disco ou no IndexedDB falhar (cota excedida, permissão revogada, lock de arquivo), o indicador de dirty desaparece e o usuário assume falsamente que o código foi salvo.
- **Impacto em Produção:** Perda de dados silenciosa ao fechar ou recarregar a página.
- **Correção Recomendada:** Aguardar o sucesso da Promise via `await` antes de alterar `isDirty: false`. Em caso de erro, manter a flag suja e emitir alerta visual na UI.

---

### 13. [ALTO] `moveFileItem` usa `move()` de 1 Argumento e Viola Unique Index no IndexedDB
- **Localização:** `src/context/EditorContext.tsx:1407-1456`, `src/services/localFs.ts:291-344` (`renameOnDisk`) e `src/services/storage.ts:92`.
- **Mecanismo da Falha:** (1) No disco, `FileSystemFileHandle.move(newName)` renomeia apenas dentro da mesma pasta. Para mover entre pastas é indispensável passar o handle do diretório de destino: `move(destDirHandle, newName)`. O arquivo permanece na pasta antiga fisicamente, gerando divergência na árvore. (2) No IndexedDB sandbox, a store possui índice único `fileStore.createIndex('path', 'path', { unique: true })`. Mover ou duplicar paths gera colisão e lança exceções não tratadas `ConstraintError`.
- **Impacto em Produção:** Arquivos não se movem no sistema de arquivos real e transações no IndexedDB quebram silenciosamente.
- **Correção Recomendada:** Obter o handle do diretório destino antes de chamar `.move(destHandle, newName)` e validar paths únicos antes de gravar no IndexedDB.

---

### 14. [ALTO] Encerramento Prematuro e Abrupto de Código Assíncrono no Worker JavaScript/TypeScript
- **Localização:** `src/workers/jsWorker.ts:106-112, 229` e `src/services/runtimes/jsRuntime.ts:264-274`.
- **Mecanismo da Falha:** `jsWorker` roda o bundle via `(0, eval)(message.code)` e aciona `scheduleFinishCheck(30)`. A função avalia apenas se `timeoutIds.size === 0 && intervalIds.size === 0`. Códigos assíncronos modernos baseados em Promises (`fetch()`, `async/await`, microtasks) sem timers ativos fazem o worker disparar `finish(0)` aos 30ms, matando a thread via `worker.terminate()` antes que a Promise resolva.
- **Impacto em Produção:** Interrupção forçada de qualquer script assíncrono em JS/TS, impedindo respostas de requisições de rede no console.
- **Correção Recomendada:** Capturar a Promise resultante da avaliação do script e adiar a verificação de término até seu assentamento completo.

---

### 15. [ALTO] Auto-Sync do Disco Remove Arquivos Dirty e Trata Scan Parcial como Exclusão
- **Localização:** `src/context/EditorContext.tsx:746-756` e `src/services/localFs.ts:357-409`.
- **Mecanismo da Falha:** `scanDirectorySnapshot` suprime exceções em bloco e retorna um `Map` parcial. O `performSync` assume que qualquer arquivo ausente do snapshot foi excluído externamente, fechando abas (`setTabs`) inclusive se estiverem marcadas como `isDirty`. Além disso, pastas com profundidade superior ao teto de 8 níveis são tratadas como inexistentes e removidas da interface.
- **Impacto em Produção:** Fechamento involuntário de abas ativas e perda de alterações não salvas sem aviso prévio.
- **Correção Recomendada:** Abortar a sincronização caso o snapshot lance erro de leitura e nunca descartar automaticamente abas que contenham modificações locais (`isDirty === true`).

---

### 16. [ALTO] `openDB` sem Handlers `blocked`/`blocking`/`terminated` Trava Workspace Silenciosamente
- **Localização:** `src/services/storage.ts:85-110` e `src/services/storage.ts:112-125`.
- **Mecanismo da Falha:** `openDB` não declara callbacks de gerenciamento de versões. Se outra aba estiver aberta com schema antigo durante um upgrade de `DB_VERSION`, a conexão trava sem erro. Adicionalmente, se a promessa inicial for rejeitada, `dbPromise` armazena o estado rejeitado permanentemente, impedindo novas tentativas.
- **Impacto em Produção:** Usuários ficam presos na tela de boas-vindas sem possibilidade de recuperação a não ser limpando manualmente os dados do navegador.
- **Correção Recomendada:** Tratar eventos `blocked`, `blocking` e `terminated`, resetando `dbPromise = null` em caso de erro para possibilitar novas tentativas.

---

### 17. [ALTO] Poluição Persistente de `sys.modules` no Python Impede Atualizações de Módulos Locais
- **Localização:** `src/workers/pythonWorker.ts:227-263`.
- **Mecanismo da Falha:** O worker executa `clearDirectory(FS, '/workspace')`, mas nunca limpa o dicionário global `sys.modules` do CPython. Quando um módulo auxiliar (ex.: `utils.py`) é alterado e reimportado pelo script principal, o interpretador reutiliza a versão em cache da memória.
- **Impacto em Produção:** Falha de integridade: modificações feitas em arquivos importados são totalmente ignoradas pelo interpretador até que a página seja recarregada.
- **Correção Recomendada:** Expurgar sistematicamente de `sys.modules` todas as entradas originadas em `/workspace` antes de cada execução.

---

### 18. [ALTO] Exportação de Workspace ZIP Destrói Conteúdo de Binários para 0 Bytes
- **Localização:** `src/context/EditorContext.tsx:611-632` (`downloadWorkspaceZip`).
- **Mecanismo da Falha:** `downloadWorkspaceZip` grava arquivos no ZIP executando `zip.file(cleanPath, f.content || '')`. Em diretórios locais, arquivos binários (imagens, fontes, sqlite) possuem `content = undefined` por design. O operador de coalescência grava uma string vazia `''`.
- **Impacto em Produção:** Backups e exportações do workspace geram arquivos binários totalmente vazios e inutilizáveis.
- **Correção Recomendada:** Carregar os bytes brutos (`readFileFromDisk`) quando `f.content` for indefinido e repassar o `Uint8Array` ao JSZip.

---

### 19. [ALTO] Duplicação de Cache e Estouro de Quota de Armazenamento no PWA
- **Localização:** `src/sw.ts:35, 72-130` e `vite.config.ts:94-99`.
- **Mecanismo da Falha:** O manifesto do Workbox precacheia todos os assets binários (~150MB). Em `sw.ts`, rotas adicionais `CacheFirst` interceptam e armazenam novamente os mesmos binários em caches separados (`wasm-tar-resources-cache`), duplicando a pegada em disco para mais de 300MB.
- **Impacto em Produção:** Violação das cotas estritas de armazenamento em dispositivos móveis (ex.: 500MB no Safari iOS), gerando erros de `QuotaExceededError`.
- **Correção Recomendada:** Eliminar rotas redundantes de runtime para assets que já constam no manifesto estático do Workbox.

---

### 20. [ALTO] Memory Leak Progressivo no Monaco por Acúmulo de `addExtraLib`
- **Localização:** `src/services/monaco/tsLanguageService.ts:56-70`.
- **Mecanismo da Falha:** A cada digitação com debounce em arquivos TS/JS, `syncWorkspaceTsFiles` invoca `addExtraLib(file.content, uri)` sem descartar (`dispose()`) a referência anterior. O Monaco acumula instâncias antigas em memória indefinidamente.
- **Impacto em Produção:** Degradação contínua da responsividade da digitação e vazamento progressivo de memória RAM na aba do editor.
- **Correção Recomendada:** Mapear os retornos `IDisposable` e invocar `.dispose()` antes de registrar novas versões dos arquivos.

---

## 🟡 SEVERIDADE MÉDIA

### 21. [MÉDIO] Cache de Compilação C/C++ Ilimitado com Risco de OOM
- **Localização:** `src/services/cCompiler.ts:227-250, 329-332`.
- **Mecanismo:** `compilationCache` armazena binários WASM inteiros (3MB a 15MB cada) sem limite de tamanho ou política de despejo LRU.
- **Impacto:** Sessões longas de desenvolvimento com compilações frequentes consomem gigabytes de memória até derrubar a aba.
- **Correção:** Limitar o cache com descarte LRU (ex.: no máximo 5 binários recentes).

---

### 22. [MÉDIO] `pythonRuntime.pending` sem Timeout nem Rejeição em Erro do Worker
- **Localização:** `src/services/runtimes/pythonRuntime.ts:42, 77-88, 360-401`.
- **Mecanismo:** Se o worker do Pyodide sofrer uma falha fatal (OOM), o callback `onerror` não rejeita as promessas em `pending` (formatação, instalação de pacotes).
- **Impacto:** Botões e estados de carregamento ficam permanentemente travados na UI sem resposta de erro.
- **Correção:** Rejeitar todas as promessas pendentes e limpar o mapa no `worker.onerror`.

---

### 23. [MÉDIO] Análise Semântica de C/C++ Síncrona na Thread de UI no Monaco
- **Localização:** `src/services/monaco/cLanguageService.ts:325-327, 860, 1076`.
- **Mecanismo:** Para cada completion e hover, o arquivo inteiro e todos os cabeçalhos são reanalisados síncronamente na thread principal.
- **Impacto:** Microtravamentos perceptíveis na digitação em arquivos médios ou grandes.
- **Correção:** Implementar cache indexado por `model.getVersionId()`.

---

### 24. [MÉDIO] Fechamento de Aba ou Navegação sem Confirmação de Conteúdo Dirty
- **Localização:** `src/context/EditorContext.tsx:873-891` e ausência de listener `beforeunload`.
- **Mecanismo:** O fechamento de abas não checa a flag `isDirty`, e a página não registra `window.onbeforeunload`.
- **Impacto:** Perda de dados em caso de fechamento acidental de abas ou recarregamento da janela com auto-save desligado.
- **Correção:** Solicitar confirmação no fechamento de abas dirty e registrar evento `beforeunload` se houver abas não salvas.

---

### 25. [MÉDIO] Identidade de Workspace Local Baseada Exclusivamente no Nome da Pasta
- **Localização:** `src/context/EditorContext.tsx:319-320, 391-398, 805`.
- **Mecanismo:** A chave de sessão `local_${dirHandle.name}` colide caso o usuário abra pastas com nomes idênticos em caminhos distintos.
- **Impacto:** Configurações de sessão e arquivos temporários são sobrescritos entre projetos homônimos.
- **Correção:** Associar um identificador único ou gerar hash representativo do handle do diretório.

---

## 🟢 SEVERIDADE BAIXA

- [ ] `src/context/EditorContext.tsx:943-957, 1260-1343`: Invocação de efeitos colaterais impuros dentro de funções updaters do React `setFiles`.
- [ ] `src/services/localFs.ts:198, 213`: `recordInternalWrite` é registrado antes da gravação real, mascarando eventos legítimos do SO caso a escrita falhe.
- [ ] `src/context/EditorContext.tsx:968-1050`: `createNewFile` não sanitiza nomes com `..` ou caracteres inválidos para o SO.
- [ ] `src/workers/wasmWorker.ts:126-137` e `src/workers/jsWorker.ts:165-171`: Entradas de terminal superiores a 65.520 bytes são truncadas silenciosamente.
- [ ] `src/sw.ts:132-140`: Cache de CDNs externas sem política de revalidação periódica.

---

## 🛡️ Áreas em Conformidade Identificadas na Auditoria

- **Sanitização contra XSS e Injeção de Comandos:** Conforme. Nenhuma manipulação insegura de DOM com `innerHTML` ou `dangerouslySetInnerHTML`. Saídas de console e nomes de arquivos são escapados nativamente pelos componentes React e xterm.
- **Manuseio de Segredos e Credenciais:** Conforme. Nenhuma chave de API, token ou segredo confidencial embutido no repositório.
- **Segurança de Acesso ao Sistema de Arquivos (Sandbox do Navegador):** Conforme. A `FileSystem Access API` impede escape para diretórios pai através de verificações nativas da sandbox do navegador.
- **Isolamento de Runtimes Pesados:** Conforme. YoWASP Clang, Pyodide e esbuild rodam estritamente isolados em Web Workers, prevenindo congelamento da thread principal durante tarefas intensivas de CPU.

---

## 🎯 Roteiro Recomendado de Remediação

1. **Fase 1 (Prevenção de Perda de Dados):** Corrigir imediatamente os itens **1, 2, 12 e 18** (bloquear destruição de arquivos > 5MB, manter integridade binária em sincronizações e corrigir exportação ZIP).
2. **Fase 2 (Estabilidade de Execução e Deadlocks):** Implementar correções dos itens **3, 4, 5 e 8** (resolver promessas na interrupção de WASI, adotar `executionToken` no `vmManager` e organizar a fila de Atomics/stdin).
3. **Fase 3 (Resiliência do Workspace e PWA):** Corrigir itens **6, 7, 10, 13 e 19** (suporte a ambientes sem SAB, serialização do manifesto de wheels e desacoplamento do carregamento inicial do Clang).
4. **Fase 4 (Higiene de Recursos e Performance):** Sanar itens **14, 16, 20 e 21** (ajuste de ciclo de vida assíncrono em JS, descarte de libs no Monaco e cache LRU).
