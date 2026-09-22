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

### 1.1 Tabela de Processos Formal (`ProcessManager` / PIDs)
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

### 1.2 Inicialização Leve e *Lazy Loading* Modular de Runtimes
- **Cenário Atual:** O `App.tsx` trava toda a interface com `LinuxLoadingScreen` até que os compiladores mais pesados (como o Clang de ~105MB) estejam completamente prontos.
- **Proposta Arquitetural:**
  - **Cold Start Sub-Segundo:** A IDE deve carregar a casca de UI (Monaco Editor, Sidebar, TitleBar) em menos de 800ms, permitindo visualização e edição de código imediata.
  - **Download sob Demanda:** O download de runtimes pesados só deve ser iniciado quando o usuário abrir ou compilar um arquivo da respectiva linguagem:
    - Se o usuário programa apenas em JavaScript/TypeScript, ele não precisa esperar nem baixar os 105MB do Clang ou 30MB do Pyodide.
    - O botão de execução exibe o status de download específico da linguagem ("Baixando Clang 32%..."), enquanto as demais linguagens já baixadas permanecem totalmente operacionais.

---

### 1.3 Fila FIFO com Backpressure para Stdin Interativo
- **Cenário Atual:** Colar múltiplos comandos ou entradas no terminal sobrecarrega o `SharedArrayBuffer` antes que o worker acorde do `Atomics.wait`, sobrescrevendo entradas não lidas.
- **Proposta Arquitetural:**
  - Implementar uma fila de buffer de entrada na thread principal.
  - Ao colar um bloco com múltiplas linhas, enfileirar todas as linhas na FIFO.
  - Gravar uma linha no SAB por vez. A linha subsequente só é enviada após o worker confirmar leitura através de alteração de estado no Atomics (`control[0] === 0`) ou disparando um evento de solicitação (`stdin_need`).

---

### 1.4 Camada Unificada de VFS Baseada em Streams e Buffers Puros
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

### 1.5 Sandboxing de Origem para Execução de JavaScript (*Process Sandboxing*)
- **Cenário Atual:** `jsWorker.ts` executa código de usuário diretamente via `eval` no mesmo domínio da aplicação. Um script malicioso pode instanciar o `indexedDB`, extrair códigos salvos em outros projetos e fazer exfiltração de dados via `fetch`.
- **Proposta Arquitetural:**
  - Segregar a execução do código de usuário dentro de um `iframe` com atributo `sandbox="allow-scripts"` hospedado em uma origem isolada (ex.: subdomínio neutro ou `data:` URI).
  - O iframe atua como runner estéril sem acesso aos armazenamentos da aplicação principal (`localStorage`, `indexedDB`, `caches`), comunicando-se exclusivamente via protocolo estrito de mensagens serializadas.

---

## 💻 Eixo 2: Experiência de Desenvolvimento (Developer Experience - DX)

### 2.1 Suporte a Múltiplos Arquivos sem Regras Mágicas
- **Cenário Atual:** O runtime de C/C++ tenta descobrir quais arquivos compilar inspecionando expressões regulares de `main()` no código-fonte, o que descarta arquivos válidos caso contenham a palavra em comentários.
- **Proposta de Melhoria:**
  - **Modo Projeto Declarativo:** Permitir definir um arquivo simples de configuração (ex.: `.theprog/project.json`) ou reconhecer um arquivo `Makefile`/`CMakeLists.txt` simplificado.
  - **Seletor de Arquivos de Compilação:** Na interface gráfica (Sidebar), permitir que o usuário marque/desmarque com um clique quais arquivos `.c`/`.cpp` devem entrar no comando do compilador.

---

### 2.2 Integração com Git Leve no Navegador (`isomorphic-git`)
- **Proposta de Valor:** Transformar o editor em uma estação completa de versionamento sem depender do executável `git` instalado na máquina:
  - Adicionar suporte à biblioteca `isomorphic-git` no navegador.
  - Capacidade de clonar repositórios públicos e privados (via Personal Access Token) direto para o IndexedDB ou para o diretório local.
  - Aba de controle de versão exibindo arquivos modificados (Status), suporte a `commit`, `diff` visual e `push`/`pull`.

---

### 2.3 Split View e Painel Flexível de Layout
- **Proposta de Melhoria:**
  - Permitir divisão da tela de edição (Split Screen vertical ou horizontal) para trabalhar com dois arquivos em paralelo (ex.: `main.c` de um lado e `utils.h` do outro).
  - Possibilidade de desacoplar o terminal de execução para uma janela flutuante ou barra lateral, aproveitando monitores ultrawide.

---

### 2.4 Pré-visualização de Markdown e Suporte a Canvas/Gráficos
- **Markdown Live Preview:** Exibição lado a lado de documentações `.md` formatadas com suporte a fórmulas LaTeX (KaTeX) e diagramas Mermaid.
- **Saída Gráfica para Python:** No Pyodide, interceptar a biblioteca `matplotlib` ou `turtle` para renderizar gráficos em um painel interativo de Canvas ao lado do terminal, enriquecendo cursos de ciência de dados e física.

---

### 2.5 Depuração Visual Básica (Debugger / Breakpoints)
- **Cenário:** Ambientes educacionais se beneficiam imensamente da execução passo a passo de algoritmos.
- **Proposta de Melhoria:**
  - No Python: O Pyodide possui suporte nativo ao módulo `bdb`/`pdb`. É possível expor uma interface visual no Monaco onde o clique na margem (gutter) adiciona breakpoints, permitindo avançar linhas (`step over`, `step into`) e inspecionar variáveis locais em tempo real.
  - No C/C++: Integrar visualizadores de pilha de memória para demonstração didática de ponteiros e structs.

---

## 🎓 Eixo 3: Recursos Educacionais & Plataforma de Treinamento

### 3.1 Painel de Casos de Teste Automatizados (Estilo Beecrowd / LeetCode)
- **Conceito:** O TheProg Editor já possui uma estrutura ideal para estudantes que treinam algoritmos para faculdades, Olimpíadas de Informática (OBI) e maratonas de programação.
- **Recurso Proposto:**
  - Criar uma aba dedicada **"Testes & Exercícios"** no painel inferior:
    ```text
    ┌────────────────────────────────────────────────────────┐
    │ Caso 1:  Input: "10 20\n"  | Esperado: "30\n" | ✅ OK  │
    │ Caso 2:  Input: "-5 5\n"   | Esperado: "0\n"  | ✅ OK  │
    │ Caso 3:  Input: "0 0\n"    | Esperado: "0\n"  | ❌ ERR │
    └────────────────────────────────────────────────────────┘
    ```
  - O estudante cadastra pares de entradas e saídas esperadas. Ao clicar em "Executar Casos", a IDE roda o programa em lote contra cada entrada e exibe um relatório com tempo de execução, memória gasta e veredito (*Accepted*, *Wrong Answer*, *Time Limit Exceeded*).

---

### 3.2 Perfilamento de Algoritmos (Métricas de Complexidade)
- Exibir no rodapé da aba de execução métricas detalhadas de engenharia:
  - **Tempo de CPU real decorrido:** `performance.now()` medido com precisão de microssegundos.
  - **Consumo de Memória Heap:** Acesso à propriedade `WebAssembly.Memory.buffer.byteLength` do runtime WASI e do interpretador Pyodide, permitindo ao estudante visualizar na prática o custo de alocações dinâmicas (`malloc` / vetores).

---

### 3.3 Catálogo Didático de Snippets e Tutoriais Interativos
- Integrar um sistema de templates educacionais pré-configurados:
  - *Estruturas de Dados:* Listas encadeadas, árvores binárias, filas e pilhas completas com explicações conceituais.
  - *Algoritmos Clássicos:* Ordenação (QuickSort, MergeSort), busca binária e grafos (Dijkstra).
  - *Modo Apresentação / Aula:* Modo focado com zoom aumentado de fontes e ocultação de barras para professores transmitirem aulas ou gravarem tutoriais.

---

## ⚡ Eixo 4: Otimização de Distribuição, PWA e Cache

### 4.1 Compressão Zstandard / Brotli para Módulos WebAssembly
- **Cenário Atual:** Os arquivos `.wasm` e pacotes stdlib são servidos descompactados ou com compressão padrão gzip.
- **Melhoria Proposta:**
  - Módulos WebAssembly possuem alta redundância estrutural. Comprimir os runtimes estáticos (`clang.wasm`, `pyodide.asm.wasm`, `esbuild.wasm`) utilizando **Zstandard (zstd)** ou **Brotli** no estágio de build pode reduzir o tamanho de transferência em até **35% a 45%**.
  - No cliente, descomprimir os bytes via Streams API (`DecompressionStream('gzip')` ou wasm zstd streamer), diminuindo drasticamente o consumo de dados em conexões móveis.

---

### 4.2 Monitoramento de Quota de Armazenamento e Limpeza Proativa
- Implementar na aba de configurações uma ferramenta visual de governança de disco:
  - Exibir gráfico em pizza com a fatia consumida por cada runtime:
    - *Clang LLVM e Libs:* ~110 MB
    - *Python & Pyodide:* ~35 MB
    - *Wheels Customizadas do Usuário:* ~X MB
    - *Workspaces Locais e IndexedDB:* ~Y MB
  - Botão de "Limpeza Granular", permitindo ao usuário remover o cache de uma linguagem que ele não utiliza mais sem precisar reiniciar toda a aplicação.

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
