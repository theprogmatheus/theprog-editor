# SUGESTOES_FUTURAS.md — Diretrizes de Evolução Arquitetural e Produto

Este documento reúne recomendações estratégicas, técnicas e conceituais elaboradas a partir da auditoria de sistemas realizada no **TheProg Editor**. O objetivo é transformar a robusta prova de conceito atual em uma plataforma de desenvolvimento web resiliente, modular e de classe mundial (*production-grade*), mantendo a premissa central de **execução 100% no cliente, privacidade total e suporte offline autônomo**.

---

## 🧭 Visão Geral & Filosofia de Engenharia

O TheProg Editor se destaca por operar como um **ambiente autocontido no navegador**, dispensando servidores de computação remota. A evolução do projeto deve focar em quatro pilares fundamentais:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PILARES DE EVOLUÇÃO                             │
├────────────────────┬───────────────────┬───────────────────────────────┤
│ 1. Resiliência de  │ 2. Modularidade   │ 3. Segurança e                │
│    Sistemas (SAB)  │    & Performance  │    Isolamento de Origem       │
├────────────────────┴───────────────────┴───────────────────────────────┤
│ 4. Recursos Didáticos & Ferramental Profissional (DX)                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ Eixo 1: Arquitetura de Sistemas & Engenharia de Runtimes

### 1.1 Tabela de Processos Formal (`ProcessManager` / PIDs) — `[IMPLEMENTADO]`
- **Cenário Atual:** O `vmManager` gerencia execuções através de flags booleanas globais (`isExecuting`, `currentController`, `activeRuntime`), o que gera condições de corrida críticas durante ciclos rápidos de parada e reinício.
- **Proposta Arquitetural:** Modelar um gerenciador de processos inspirado em sistemas operacionais:
  - Cada execução instanciada gera uma estrutura de processo imutável com um **PID monotônico único** (`pid: number`).
  - O processo possui uma máquina de estados finita: `IDLE` → `SPAWNING` → `RUNNING` → `INTERRUPTING` → `TERMINATED`.
  - Todas as mensagens trocadas com os Web Workers (stdout, stderr, stdin, fs_sync, exit) passam a carregar o `pid`.
  - Se uma mensagem chegar do worker endereçada a um `pid` já finalizado ou descartado, ela é ignorada sumariamente, eliminando ruídos em execuções subsequentes.

```typescript
// Exemplo de modelagem do ProcessManager
export interface ProcessDescriptor {
  pid: number;
  runtime: RuntimeId;
  entryFile: string;
  status: 'starting' | 'running' | 'stopping' | 'terminated';
  worker: Worker;
  stdinQueue: string[];
  abortController: AbortController;
  startTime: number;
}
```

---

#### 1.2 Inicialização Leve e *Lazy Loading* Modular de Runtimes — `[IMPLEMENTADO]`
- **Cenário Atual:** O `App.tsx` trava toda a interface com `LinuxLoadingScreen` até que os compiladores mais pesados (como o Clang de ~105MB) estejam completamente prontos.
- **Proposta Arquitetural:**
  - **Cold Start Sub-Segundo:** A IDE deve carregar a casca de UI (Monaco Editor, Sidebar, TitleBar) em menos de 800ms, permitindo visualização e edição de código imediata.
  - **Download sob Demanda:** O download de runtimes pesados só deve ser iniciado quando o usuário abrir ou compilar um arquivo da respectiva linguagem:
    - Se o usuário programa apenas em JavaScript/TypeScript, ele não precisa esperar nem baixar os 105MB do Clang ou 30MB do Pyodide.
    - O botão de execução exibe o status de download específico da linguagem ("Baixando Clang 32%..."), enquanto as demais linguagens já baixadas permanecem totalmente operacionais.

---

### 1.3 Fila FIFO com Backpressure para Stdin Interativo — `[IMPLEMENTADO]`
- **Cenário Atual:** Colar múltiplos comandos ou entradas no terminal sobrecarrega o `SharedArrayBuffer` antes que o worker acorde do `Atomics.wait`, sobrescrevendo entradas não lidas.
- **Proposta Arquitetural:**
  - Implementar uma fila de buffer de entrada na thread principal.
  - Ao colar um bloco com múltiplas linhas, enfileirar todas as linhas na FIFO.
  - Gravar uma linha no SAB por vez. A linha subsequente só é enviada após o worker confirmar leitura através de alteração de estado no Atomics (`control[0] === 0`) ou disparando um evento de solicitação (`stdin_need`).

---

### 1.4 Camada Unificada de VFS Baseada em Streams e Buffers Puros — `[IMPLEMENTADO]`
- **Cenário Atual:** O editor manipula arquivos de forma ambígua (strings em `FileItem.content`, handles de disco e `Uint8Array` nos workers), resultando em corrupção de binários e truncamento de arquivos grandes.
- **Proposta Arquitetural:**
  - Criar uma abstração unificada de `VirtualFileSystem`:
    ```typescript
    export interface VFile {
      id: string;
      path: string;
      kind: 'text' | 'binary' | 'image' | 'too_large';
      size: number;
      updatedAt: number;
      readBytes(): Promise<Uint8Array>;
      readText(): Promise<string>;
      write(data: Uint8Array | string): Promise<void>;
    }
    ```
  - Tratar a leitura de arquivos grandes via streaming/chunks sob demanda, impedindo o carregamento forçado de dezenas de megabytes na memória heap do React durante o escaneamento inicial de diretórios.
  - Garantir que binários gerados pelo código em C (`.png`, `.sqlite`, `.bin`) permaneçam como buffers brutos (`Uint8Array`) durante todo o pipeline até a escrita física no disco.

---

### 1.5 Sandboxing de Origem para Execução de JavaScript (*Process Sandboxing*) — `[IMPLEMENTADO]`
- **Cenário Atual:** `jsWorker.ts` executa código de usuário diretamente via `eval` no mesmo domínio da aplicação. Um script malicioso pode instanciar o `indexedDB`, extrair códigos salvos em outros projetos e fazer exfiltração de dados via `fetch`.
- **Proposta Arquitetural:**
  - Segregar a execução do código de usuário desativando e revogando o escopo de `indexedDB`, `caches`, `fetch`, `XMLHttpRequest`, `WebSocket` e `Worker`.
  - O worker atua como runner estéril sem acesso aos armazenamentos da aplicação principal, comunicando-se exclusivamente via protocolo estrito de mensagens e SharedArrayBuffer.

---

## 💻 Eixo 2: Experiência de Desenvolvimento (Developer Experience - DX)

### 2.1 Suporte a Múltiplos Arquivos sem Regras Mágicas — `[IMPLEMENTADO]`
- **Cenário Atual:** O runtime de C/C++ tenta descobrir quais arquivos compilar inspecionando expressões regulares de `main()` no código-fonte, o que descarta arquivos válidos caso contenham a palavra em comentários.
- **Proposta de Melhoria:**
  - **Modo Projeto Declarativo:** Definir um arquivo simples de configuração (`.theprog/project.json`) especificando fontes (`sources`), cabeçalhos (`includeDirs`) e flags (`flags`).
  - **Resolução Automática:** Caso não haja configuração declarativa, resolução de fontes C/C++ vinculados sem heurísticas frágeis de regex.

---

### 2.2 Integração com Git Leve no Navegador (`isomorphic-git`) — `[IMPLEMENTADO]`
- **Proposta de Valor:** Transformar o editor em uma estação completa de versionamento sem depender do executável `git` instalado na máquina:
  - Adicionar suporte à biblioteca `isomorphic-git` no navegador.
  - Painel lateral dedicado de Git com visualização de status em tempo real, staging, histórico de commits com hash SHA e diff visual.

---

### 2.3 Split View e Painel Flexível de Layout — `[IMPLEMENTADO]`
- **Proposta de Melhoria:**
  - Divisão da tela de edição (Split View horizontal/vertical) para trabalhar com dois arquivos em paralelo com sincronização dinâmica.

---

### 2.4 Pré-visualização de Markdown e Suporte a Canvas/Gráficos — `[IMPLEMENTADO]`
- **Markdown Live Preview:** Exibição lado a lado de documentações `.md` formatadas com renderizador nativo seguro e blocos de código estilizados.

---

### 2.5 Depuração Visual Básica (Debugger / Breakpoints) — `[IMPLEMENTADO]`
- **Proposta de Melhoria:**
  - Gerenciador de breakpoints reativo com estado unificado (`DebuggerManager`), permitindo ativar/desativar breakpoints por linha e arquivo.

---

## 🎓 Eixo 3: Recursos Educacionais & Plataforma de Treinamento

### 3.1 Painel de Casos de Teste Automatizados (Estilo Beecrowd / LeetCode) — `[IMPLEMENTADO]`
- **Conceito:** O TheProg Editor já possui uma estrutura ideal para estudantes que treinam algoritmos para faculdades, Olimpíadas de Informática (OBI) e maratonas de programação.
- **Recurso Proposto:**
  - Criar aba dedicada **"Testes & Casos"** no console inferior com suporte a múltiplos casos de teste, cálculo de veredito em tempo real (Accepted, Wrong Answer, Runtime Error, Time Limit Exceeded) e diff visual entre esperado e obtido.

---

### 3.2 Perfilamento de Algoritmos (Métricas de Complexidade) — `[IMPLEMENTADO]`
- **Recurso Proposto:**
  - Medição de tempo de CPU e execução com alta precisão (`performance.now()`) emitidas no evento de término do processo.

---

### 3.3 Catálogo Didático de Snippets e Tutoriais Interativos — `[IMPLEMENTADO]`
- **Recurso Proposto:**
  - Catálogo modal interativo com estruturas de dados clássicas (Árvores Binárias de Busca, Grafos / Dijkstra, QuickSort, templates OBI / Maratonas) com inserção direta no workspace com um clique.

---

## ⚡ Eixo 4: Otimização de Distribuição, PWA e Cache

### 4.2 Monitoramento de Quota de Armazenamento e Limpeza Proativa — `[IMPLEMENTADO]`
- **Recurso Proposto:**
  - Ferramenta de governança de cache no modal de configurações permitindo purga granular de runtimes específicos (Clang, Pyodide ou todos).

---

## 🗺️ Matriz de Priorização do Roadmap

| Fase | Foco Estratégico | Itens Abrangidos | Impacto no Usuário |
| :--- | :--- | :--- | :--- |
| **Fase 1** | **Estabilidade & Proteção de Dados** | • Correção dos 6 bugs Críticos do `A_CORRIGIR.md`<br>• Implementação de `too_large` em arquivos > 5MB<br>• Preservação de binários sem conversão UTF-8 | Elimina perda de dados e travamentos definitivos. |
| **Fase 2** | **Concorrência & Lifecycle** | • Criação do `ProcessManager` com PIDs<br>• Fila FIFO de Stdin/Atomics para paste<br>• Lazy-loading modular de runtimes | O app abre em < 1s e o terminal não perde entradas. |
| **Fase 3** | **Segurança & VFS Robusto** | • Sandboxing de origem para execução de JS<br>• VFS unificado com buffers brutos<br>• Descarte de vazamentos de memória no Monaco | Confiabilidade de longo prazo em sessões pesadas. |
| **Fase 4** | **Ferramental & Diferenciais de Produto** | • Painel de Casos de Teste (estilo maratona)<br>• Métricas de memória e CPU do algoritmo<br>• Prévia de Markdown / Canvas | Transforma a IDE na melhor ferramenta educacional web. |

---

*Documento gerado com base na auditoria técnica de engenharia de sistemas em 22 de setembro de 2026.*
