# 📐 08_CONVENTIONS_AND_STANDARDS.md — Convenções, Padrões de Código e Lições Aprendidas

> **TheProg Editor — Documentação Técnica Canônica**  
> *Versão do Sistema: `v0.6.0`*

---

## 1. Disciplina de Engenharia & TypeScript Estrito

No **TheProg Editor**, a integridade dos dados e a prevenção de travamentos são prioridades absolutas. Para assegurar essa estabilidade em um ecossistema complexo com múltiplos Web Workers e WebAssembly, seguimos padrões rigorosos:

### 1.1 Tolerância Zero a `as any` Injustificado
- O uso de `any` mascara falhas de contrato que se manifestam como exceções de execução em produção.
- Caso uma Web API emergente não esteja nos tipos oficiais da biblioteca DOM do TypeScript (como a WICG File System Access API), crie ou estenda declarações de tipos ambientais em `src/types/` (ex.: [`src/types/filesystem.d.ts`](file:///src/types/filesystem.d.ts)).
- Ao interagir com instâncias do Monaco Editor, utilize as tipagens oficiais:
  - `monaco.editor.IStandaloneCodeEditor`
  - `monaco.editor.IStandaloneDiffEditor`

### 1.2 Imutabilidade e Updaters Puros no React 19
- **Updaters Devem Ser Puros:** Funções passadas para `setFiles(prev => ...)` ou `setTabs(prev => ...)` **nunca** devem disparar efeitos colaterais (como chamar `saveFileToDisk`, emitir alertas ou manipular o IndexedDB). Efeitos colaterais devem ser orquestrados fora do ciclo de reconciliação.
- **Evitar `react(set-state-in-effect)`:** Chamar `setState` de forma síncrona dentro de um `useEffect` causa re-renderizações em cascata e impede a otimização pelo React Compiler. Prefira derivar valores durante o render ou atualizar o estado a partir do evento que causou a alteração.

---

## 2. Invariantes de Concorrência e Workers

### 2.1 Resolução Garantida de Promises com Workers
Sempre que uma rotina encapsular a execução de um Web Worker em uma `Promise`:
```typescript
// REGRA CRÍTICA: O cleanup DEVE resolver ou rejeitar a Promise
const cleanup = (exitCode = 130) => {
  if (!isFinished) {
    isFinished = true;
    try { worker.terminate(); } catch {}
    resolve(exitCode); // Impede que a cadeia assíncrona fique congelada para sempre
  }
};
```
Se a Promise depender exclusivamente de mensagens do worker (`onmessage`) para chamar `resolve()`, e o worker for encerrado abruptamente via `worker.terminate()`, a Promise nunca será resolvida, gerando **deadlock e vazamento permanente de memória heap**.

### 2.2 Controle de Concorrência por PID
Nunca utilize variáveis booleanas soltas como `isExecuting = true` para coordenar fluxos assíncronos. Todas as mensagens entre a thread de UI e os workers devem transportar o **PID monotônico único** emitido pelo [`ProcessManager`](file:///src/services/process/processManager.ts). Mensagens recebidas de um PID antigo ou cancelado devem ser sumariamente descartadas.

---

## 3. Preservação de Dados e Integridade do Filesystem

### 3.1 Tratamento Seguro de Binários
- **Nunca decodifique buffers desconhecidos com `TextDecoder`:** A conversão de um `Uint8Array` contendo dados binários arbitrários (PNG, WASM, SQLite) para string substitui sequências de bytes inválidas pelo caractere `\uFFFD`, corrompendo o arquivo de forma irreversível.
- Salve binários sempre como `Uint8Array` puro diretamente no IndexedDB ou via `FileSystemWritableFileStream.write(BufferSource)`.

### 3.2 Prevenção de Destruição por Placeholders
- Arquivos com mais de $5\text{ MB}$ no disco local recebem `kind: 'too_large'`.
- As rotinas `saveActiveFile` e `autoSave` devem abortar a escrita se `kind === 'too_large'`.
- Nunca grave textos de aviso (como `/* Arquivo muito grande */`) no arquivo físico do usuário.

### 3.3 Registro Seguro de Escrita Interna (`recordInternalWrite`)
Ao gravar um arquivo no disco físico com a File System Access API:
- Registre o caminho no cache de escritas internas **após** a gravação física ser bem-sucedida, nunca antes. Se for registrado antes e a escrita falhar, o sistema desconsiderará eventos legítimos do sistema operacional.

---

## 4. Ferramental de Qualidade: Linter e Testes

### 4.1 Linter Ultrarrápido (`oxlint`)
O projeto utiliza o `oxlint` (baseado em Rust) para análise estática:
```bash
npm run lint
```
- **Meta do Repositório:** **0 erros** de linter. Qualquer PR ou alteração que introduza novos erros de lint não deve ser mesclada.

### 4.2 Testes Unitários (`vitest`)
```bash
npm test
```
- Testes automatizados cobrem indexação de árvore de arquivos, caminhos aninhados, ProcessManager, GitEngine, VFS e compiladores.

---

## 5. Padrão de Commits e Governança SemVer

### 5.1 Conventional Commits
As mensagens de commit devem seguir o formato padronizado:
- `feat(modulo): nova funcionalidade para o usuário`
- `fix(modulo): correção de bug ou falha de sistema`
- `docs(modulo): alterações em documentações ou comentários`
- `refactor(modulo): refatoração sem alteração de comportamento externo`
- `perf(modulo): melhoria de desempenho ou redução de bundle`
- `test(modulo): adição ou correção de testes`
- `release(versao): promoção formal de release de versão`

### 5.2 Versionamento Semântico (SemVer 2.0.0)
- **MAJOR (`x.0.0`):** Mudanças incompatíveis na API ou redesign destrutivo do armazenamento.
- **MINOR (`0.x.0`):** Adição de novos subsistemas, novos runtimes ou melhorias retrocompatíveis.
- **PATCH (`0.0.x`):** Correções de bugs e ajustes de estabilidade.

### 5.3 Atualização Obrigatória do `CHANGELOG.md`
Toda modificação relevante deve ser registrada no [`CHANGELOG.md`](file:///CHANGELOG.md) sob o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), agrupada em seções (`Added`, `Changed`, `Fixed`, `Security`, `Performance`).

---

## 6. Catálogo Resumido de Armadilhas Históricas (Lições de `A_CORRIGIR.md`)

| Armadilha Histórica | Mecanismo do Erro | Como Evitar Hoje |
| :--- | :--- | :--- |
| **Sobrescrita de Arquivos > 5MB** | Placeholders de texto sendo gravados de volta no disco pelo auto-save. | Utilizar a trava `kind: 'too_large'` e checar antes de qualquer gravação. |
| **Corrupção de Imagens e Wasm** | Conversão de `Uint8Array` para string via `TextDecoder` no sync do runner. | Manter buffers brutos e testar com `detectFileKindFromBytes()`. |
| **Deadlock ao Cancelar WASI** | `worker.terminate()` executado sem resolver a `Promise` do runner. | Resolver a Promise com código `130` dentro do bloco `cleanup()`. |
| **Perda de Stdin em Paste Rápido** | Sobrescrita de `SharedArrayBuffer` antes de o worker consumir. | Enfileirar linhas na `stdinQueue` FIFO e despachar uma por vez. |
| **Script JS Acessando Storage** | Códigos de usuário rodando com acesso a `indexedDB` e `fetch`. | Aplicar `sanitizeGlobalScope()` no `jsWorker.ts` antes de avaliar o código. |
