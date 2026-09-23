# TODO_FILE_EXPLORER.md — Roadmap de Modernização do Explorador de Arquivos

> **Status do Projeto:** TheProg Editor v0.5.0  
> **Módulo:** Explorador de Arquivos (`Sidebar.tsx`, `EditorContext.tsx`, `localFs.ts`, `storage.ts`)  
> **Diretriz Arquitetural:** 100% Client-Side / PWA, Zero Dependências Pesadas, Desempenho O(1)/O(N) Otimizado no DOM.

---

## 🧭 Diagnóstico da Arquitetura Atual

Atualmente, o explorador de arquivos do **TheProg Editor** é implementado no componente monolítico [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx) (~850 linhas) com o estado global gerenciado pelo [`EditorContext.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/context/EditorContext.tsx):

- **Estrutura de Dados:** Lista plana de objetos `FileItem[]` com ponteiros relacionais (`parentId: string | null`, `path: string`).
- **Renderização da Árvore:** Executada por recursão direta `renderTree(parentId, depth)` que realiza `.filter()` e `.sort()` em todos os nós da lista a cada ciclo de renderização do React, sem memoização (`useMemo`).
- **Drag & Drop:** Implementado nativamente com HTML5 (`draggable`, `dataTransfer`), suportando movimentação interna entre pastas e raiz.
- **Limitações Críticas Identificadas:**
  1. A árvore reprocessa O(N) operações de array para cada nível de pasta aberto.
  2. Validações estritas de strings barram qualquer caractere `/` ou `\`, impossibilitando criação de caminhos aninhados (`src/utils/math.c`).
  3. Não existe modo preview (todas as abas abertas acumulam-se indefinidamente como abas fixas).
  4. Ausência de navegação por teclado e acessibilidade WAI-ARIA (`role="tree"`).
  5. Ausência de recursos modernos como *Compact Folders* (pastas de filho único compactadas) e *Type-to-filter*.

---

## 📋 Matriz de Conformidade dos Recursos Modernos

| # | Recurso Moderno | Status Atual | Arquivo & Linhas Principais |
|---|---|---|---|
| **1** | **Criação de Caminhos Compostos/Aninhados** | ✅ **Concluído** | [`src/services/fileTree/pathUtils.ts`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/services/fileTree/pathUtils.ts), [`EditorContext.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/context/EditorContext.tsx) |
| **2** | **Compactação de Pastas de Filho Único (*Compact Folders*)** | ✅ **Concluído** | [`src/services/fileTree/treeIndex.ts`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/services/fileTree/treeIndex.ts), [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx), [`SettingsModal.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/modals/SettingsModal.tsx) |
| **3** | **Filtro Rápido na Árvore (*Type-to-filter*)** | ✅ **Concluído** | [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx) (botão de busca, atalho `Ctrl+F`, `<mark>` em tempo real) |
| **4** | **Respeito a Arquivos Ocultos e `.gitignore`** | ✅ **Concluído** | [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx) (atenuação visual `opacity-60` para arquivos `.` e pastas de build/dependências) |
| **5** | **Auto-Reveal / Sincronização Bidirecional Ativa** | ✅ **Concluído** | [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx) (expansão reativa de ancestrais via `getAncestorFolderIds` e `scrollIntoView` suave) |
| **6** | **Ações de Cabeçalho e Context Menu Aprimorado** | ✅ **Concluído** | [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx) (botão Colapsar Todas, Copiar Caminho Relativo, Copiar Nome, Duplicar, Download) |
| **7** | **Navegação por Teclado & Acessibilidade** | ✅ **Concluído** | [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx) (WAI-ARIA `role="tree"`, `role="treeitem"`, setas, `Enter`, `F2`, `Delete`) |
| **8** | **Modo Preview vs. Pin de Arquivos** | ✅ **Concluído** | [`EditorContext.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/context/EditorContext.tsx), [`EditorArea.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/EditorArea.tsx), [`SettingsModal.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/modals/SettingsModal.tsx) |
| **9** | **Drag-and-Drop Leve (Arquivos e Pastas)** | ✅ **Concluído** | [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx) (D&D interno, importação externa do SO via `dataTransfer.files`, auto-expand 500ms no hover) |

---

## 🎯 Backlog de Implementação Detalhado

---

### 🟢 FASE 1: Quick Wins & Usabilidade Imediata
*Foco: Correções de baixo acoplamento e alto impacto imediato na produtividade do desenvolvedor.*

#### 1.1 Criação de Arquivos e Pastas com Caminhos Compostos/Aninhados
- **Descrição:** Permitir que o desenvolvedor digite caminhos como `src/components/Button.tsx` ou `include/math/vec3.h` no campo de criação rápida. O sistema deve analisar as barras (`/`), criar recursivamente todas as pastas intermediárias ausentes e instanciar o arquivo final na pasta folha correspondente.
- **Arquitetura da Solução:**
  - Em [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx): flexibilizar `isInvalidItemName` para permitir `/` caso não contenha segmentos vazios (`//`), `..` ou caracteres proibidos do SO (`: * ? " < > |`).
  - No [`EditorContext.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/context/EditorContext.tsx): criar função `createNestedPath(fullPath: string, isFolder: boolean, parentId: string | null)`:
    1. Normalizar segmentos: `fullPath.split('/').filter(Boolean)`.
    2. Percorrer os segmentos sucessivos localizando pastas já existentes na memória (`files`).
    3. Criar sequencialmente cada pasta inexistente via `createFolderOnDisk` ou `saveFileToStorage`.
    4. Criar o item final (arquivo ou pasta).
    5. Adicionar automaticamente os IDs de todas as pastas intermediárias criadas ao estado `expandedFolders`.
- **Critério de Aceite (DoD):**
  - Digitar `a/b/c/main.c` na raiz cria as pastas `a`, `b`, `c` e o arquivo `main.c` dentro de `c`.
  - Funciona tanto no modo Sandbox (IndexedDB) quanto no modo Local (File System Access API).
  - O arquivo é imediatamente aberto no editor e a árvore de diretórios expande até revelá-lo.
- **Considerações de Performance:**
  - Evitar disparos múltiplos de `setFiles` em loop; agrupar todas as novas pastas e o arquivo em uma única atualização atômica de estado (`setFiles(prev => [...prev, ...novosItens])`).

#### 1.2 Botão "Colapsar Todos" (*Collapse Folders*) no Cabeçalho
- **Descrição:** Adicionar botão no cabeçalho do explorador para fechar todas as pastas abertas com um único clique.
- **Arquitetura da Solução:**
  - Adicionar botão com ícone `ChevronsDownUp` (ou `FolderMinus`) em [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx) ao lado de `FilePlus` e `FolderPlus`.
  - Handler: `setExpandedFolders(new Set())`.
- **Critério de Aceite (DoD):**
  - Ao clicar, todo o estado `expandedFolders` é limpo e a árvore exibe apenas a raiz.
- **Considerações de Performance:**
  - Operação pura em memória O(1), forçando um único ciclo de reconciliação do React.

#### 1.3 Menu de Contexto Aprimorado (Copiar Caminhos e Duplicar)
- **Descrição:** Expandir o menu de clique com o botão direito para incluir ações utilitárias indispensáveis.
- **Ações a Adicionar:**
  - **Copiar Caminho Relativo:** Ex.: `src/utils/math.c` (`navigator.clipboard.writeText(file.path.replace(/^\//, ''))`).
  - **Copiar Nome:** Ex.: `math.c`.
  - **Duplicar Arquivo:** Cria cópia exata do arquivo no mesmo diretório com sufixo `copy` (ex.: `math.copy.c`).
  - **Download do Arquivo:** Para ambientes Sandbox, dispara download do blob no navegador com `URL.createObjectURL`.
- **Critério de Aceite (DoD):**
  - As opções funcionam tanto para arquivos quanto para pastas, com confirmações visuais sutis (toasts ou ícone de check temporário).
- **Considerações de Performance:**
  - Leitura sob demanda do conteúdo do arquivo apenas no momento do clique, sem carregar buffers preventivos na memória.

#### 1.4 Esmaecimento Visual de Arquivos Ocultos e Padrões `.gitignore`
- **Descrição:** Diferenciar visualmente itens de configuração e arquivos iniciados com ponto (`.env`, `.gitignore`, `.theprog`).
- **Arquitetura da Solução:**
  - Adicionar regra de CSS: itens iniciados com `.` recebem estilo atenuado (`opacity-60 hover:opacity-100 transition-opacity`).
  - Adicionar parser leve de padrões básicos de `.gitignore` (ex.: `*.o`, `build/`, `dist/`) para marcar `item.isIgnored = true` e aplicar cor atenuada idêntica ao VS Code.
- **Critério de Aceite (DoD):**
  - Arquivos `.env`, `.gitignore`, `.theprog` e binários ignorados aparecem estilizados sem poluírem a visibilidade do código principal.
- **Considerações de Performance:**
  - Avaliação de regex executada apenas na indexação da árvore via `useMemo`, sem recalcular classes em tempo de renderização de cada nó.

---

### 🟡 FASE 2: Estrutura da Árvore & Performance
*Foco: Otimizações algorítmicas da árvore de diretórios, navegação por teclado e sincronização visual.*

#### 2.1 Indexação e Memoização Estrutural da Árvore (Otimização O(1) de Adjacência)
- **Problema Atual:** [`renderTree(parentId, depth)`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx#L346) executa `files.filter()` e `files.sort()` recursivamente a cada render, escalando em tempo de CPU conforme o número de pastas e arquivos cresce.
- **Arquitetura da Solução:**
  - Criar um hook/memo que transforma a lista plana `files` em um grafo de adjacência memoizado:
    ```typescript
    interface DirectoryIndex {
      childrenByParentId: Map<string | null, FileItem[]>;
      fileById: Map<string, FileItem>;
      ancestorsById: Map<string, string[]>;
    }
    ```
  - A renderização da árvore consulta `childrenByParentId.get(folderId)` em tempo O(1).
- **Critério de Aceite (DoD):**
  - Em workspaces com centenas de arquivos, a expansão/recolhimento de pastas ocorre a 60fps sem engasgos na thread principal.
- **Considerações de Performance:**
  - O grafo é recalculado exclusivamente quando o array `files` sofrer mutação (adição/remoção/renomeação), eliminando custo de CPU durante digitação no editor.

#### 2.2 Compactação de Pastas Vazias de Filho Único (*Compact Folders / Folder Nesting*)
- **Descrição:** Agrupar visualmente diretórios encadeados sem bifurcações em uma única linha (ex.: exibir `src / main / c` em vez de três linhas aninhadas com recuos sucessivos).
- **Arquitetura da Solução:**
  - Durante o cálculo da árvore, inspecionar se uma pasta `A` contém **exclusivamente 1 item filho** e se este filho também é uma pasta `B`.
  - Se verdadeiro, colapsar `A` e `B` em um nó composto visual:
    - Rótulo: `A / B`.
    - Ao clicar para abrir/fechar, ambas as pastas são expandidas/colapsadas juntas.
    - O menu de contexto ou botões de criação atuam sobre a pasta mais interna (`B`).
- **Critério de Aceite (DoD):**
  - Pastas aninhadas de estruturas padrão Java/C (ex.: `src/main/resources`) ocupam apenas uma única linha horizontal no explorador.
  - Alternância configurável em `UserSettings` (`compactFolders: boolean`, padrão `true`).
- **Considerações de Performance:**
  - Compactação pura de apresentação no frontend: o disco físico e o IndexedDB mantêm as pastas perfeitamente desacopladas.

#### 2.3 Auto-Reveal com Sincronização Bidirecional Ativa & Scroll-Into-View
- **Descrição:** Ao alternar abas no Monaco Editor ou abrir arquivos por comandos rápidos (Quick Open / Go to File), o explorador de arquivos deve expandir automaticamente todas as pastas ancestrais até o arquivo ativo e rolá-lo suavemente até o campo visível da barra lateral.
- **Arquitetura da Solução:**
  - Usar o mapa pré-computado `ancestorsById.get(activeFileId)`.
  - No [`Sidebar.tsx`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/components/layout/Sidebar.tsx), `useEffect` ouvindo `activeFileId`:
    ```typescript
    useEffect(() => {
      if (!activeFileId) return;
      const ancestors = getAncestorFolderIds(activeFileId, files);
      setExpandedFolders((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const pid of ancestors) {
          if (!next.has(pid)) {
            next.add(pid);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      // Scroll suave do elemento focado
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-tree-file-id="${activeFileId}"]`);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }, [activeFileId, files]);
    ```
- **Critério de Aceite (DoD):**
  - Focar qualquer aba no editor abre instantaneamente todas as pastas intermediárias na árvore e posiciona o item visível na tela sem layout shifts abruptos.
- **Considerações de Performance:**
  - Uso de `requestAnimationFrame` para executar o scroll somente após a reconciliação do DOM das pastas recém-expandidas.

#### 2.4 Navegação Completa por Teclado e Acessibilidade (WAI-ARIA Treeview)
- **Descrição:** Permitir controle total do explorador de arquivos sem mouse.
- **Padrões de Teclas a Implementar:**
  - `ArrowDown` / `ArrowUp`: Navega sequencialmente entre os nós visíveis (pastas e arquivos).
  - `ArrowRight`: Em pasta fechada, expande; em pasta aberta, entra no primeiro filho; em arquivo, não faz nada.
  - `ArrowLeft`: Em pasta aberta, fecha; em pasta fechada ou arquivo, move o foco para a pasta pai.
  - `Enter` / `Space`: Abre o arquivo focado ou alterna expansão da pasta.
  - `F2`: Dispara o modo de renomeação inline (`editingId`).
  - `Delete` / `Backspace`: Abre modal de confirmação de exclusão do item focado.
- **Critério de Aceite (DoD):**
  - O container da árvore possui `role="tree"`, itens possuem `role="treeitem"`, `aria-expanded` e `tabIndex`.
  - Navegação fluida e acessível para leitores de tela e usuários de atalhos.
- **Considerações de Performance:**
  - Manter apenas uma lista linear plana de IDs visíveis (`visibleNodeIds`) derivada da árvore expandida, permitindo navegação por índice O(1).

---

### 🔵 FASE 3: Operações Avançadas & DX Profissional
*Foco: Recursos avançados de IDE profissional sem comprometer o bundle nem introduzir dependências externas.*

#### 3.1 Modo Preview vs. Pin de Arquivos (*Transient Tabs*)
- **Problema Atual:** Cada arquivo clicado na Sidebar cria uma aba permanente. Ao navegar explorando código de terceiros ou bibliotecas, o cabeçalho de abas fica rapidamente congestionado com dezenas de abas desnecessárias.
- **Arquitetura da Solução:**
  - Estender `EditorTab` em [`src/types/editor.ts`](file:///C:/Users/matheus.ferreira/Desktop/theprog-editor/src/types/editor.ts):
    ```typescript
    export interface EditorTab {
      fileId: string;
      filePath: string;
      title: string;
      language: SupportedLanguage;
      isDirty?: boolean;
      isPreview?: boolean; // Novo atributo
    }
    ```
  - **Comportamento de Clique Simples:** Abre o arquivo em modo preview (`isPreview: true`). Se já existir uma aba em preview que não tenha sido modificada (`!isDirty`), ela é substituída pelo novo arquivo.
  - **Comportamento de Duplo Clique:** Abre o arquivo de forma definitiva (`isPreview: false`), mantendo sua aba fixa permanentemente.
  - **Promoção Automática a Pin:** Se o usuário começar a digitar no Monaco Editor (`updateFileContent`), a aba provisória é promovida automaticamente para aba fixa (`isPreview: false`).
  - **Estilização Visual:** Título da aba provisória exibido com fonte em itálico (`font-style: italic`).
- **Critério de Aceite (DoD):**
  - Clicar sequencialmente em 10 arquivos diferentes na Sidebar reutiliza a mesma aba de visualização provisória em itálico, evitando proliferação de abas.
  - Duplo clique fixa a aba. Edição de texto fixa a aba automaticamente.
- **Considerações de Performance:**
  - Reduz drasticamente a quantidade de modelos Monaco e nós DOM de abas ativos em memória.

#### 3.2 Filtro Rápido Inline na Árvore (*Type-to-Filter*)
- **Descrição:** Filtrar arquivos e pastas instantaneamente direto no explorador com destaque visual dos termos correspondentes.
- **Arquitetura da Solução:**
  - Atalho de teclado: ao focar a Sidebar e digitar caracteres ou pressionar `Ctrl+F` / `Cmd+F`, exibe um input compacto flutuante no topo da árvore.
  - Algoritmo de correspondência leve (insensível a maiúsculas/minúsculas e busca por substrings).
  - Nós que combinam são destacados; pastas que contêm filhos correspondentes são mantidas abertas automaticamente durante a filtragem.
  - `Escape` limpa o filtro e restaura o estado anterior de expansão de pastas.
- **Critério de Aceite (DoD):**
  - Digitar `.c` oculta temporariamente arquivos que não correspondam à extensão e mantém a hierarquia das pastas pais visível com os termos grifados.
- **Considerações de Performance:**
  - Filtro 100% em memória sobre a lista `files`, sem disparar leituras no disco ou no IndexedDB.

#### 3.3 Drag-and-Drop de Arquivos Externos do Sistema Operacional & Auto-Expand no Hover
- **Descrição:** Arrastar arquivos ou pastas diretamente do Explorador de Arquivos do Windows / Finder do macOS para a Sidebar da IDE deve importá-los automaticamente para o workspace.
- **Recursos Adicionais de D&D:**
  - **Importação Externa via Drop:** Interceptar `e.dataTransfer.files` no `onDrop` da raiz ou de pastas específicas, lendo bytes via `FileReader`/`arrayBuffer()` e gravando nos runtimes/storage.
  - **Auto-Expand no Hover:** Ao arrastar um arquivo interno ou externo e pairar sobre uma pasta fechada por mais de 500ms, a pasta deve se expandir automaticamente para permitir soltar o item em seus subdiretórios.
  - **Indicador Visual de Inserção:** Linha horizontal de inserção indicando se o item será solto antes, dentro ou depois da pasta/arquivo alvo.
- **Critério de Aceite (DoD):**
  - Arrastar uma imagem `.png` ou arquivo de código `.c` da área de trabalho do computador e soltá-lo sobre a Sidebar importa o arquivo instantaneamente com preservação de integridade binária.
  - Hover sobre pasta durante drag abre a pasta automaticamente após 500ms.
- **Considerações de Performance:**
  - Leitura assíncrona por streams/blobs, prevenindo travamento da interface gráfica durante importação de arquivos maiores.

---

## 🏗️ Guia de Implementação e Arquitetura Recomendada

Para manter a separação de responsabilidades e evitar que `Sidebar.tsx` continue crescendo como componente monolítico, recomenda-se a seguinte decomposição modular:

```text
src/components/layout/sidebar/
├── Sidebar.tsx                  # Casca principal, redimensionamento e cabeçalho
├── FileTree.tsx                 # Container com listeners de teclado e navegação
├── FileTreeItem.tsx             # Nó individual (memoizado com React.memo)
├── FileTreeCompactFolder.tsx    # Renderização de pastas unificadas (A / B / C)
├── FileTreeInlineInput.tsx      # Input de criação e renomeação
├── FileTreeFilter.tsx           # Barra de busca rápida inline
└── FileContextMenu.tsx          # Menu suspenso de ações de clique direito
```

```text
src/services/fileTree/
├── treeIndex.ts                 # Grafo O(1) de adjacência, busca de ancestrais e compactação
├── pathUtils.ts                 # Resolução de caminhos compostos (a/b/c)
└── keyboardNav.ts               # Máquina de estados para navegação por setas (WAI-ARIA)
```

---

*Documento técnico elaborado a partir da auditoria da base de código do TheProg Editor v0.5.0.*
