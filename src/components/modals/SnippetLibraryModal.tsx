import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Copy,
  Check,
  FilePlus,
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';

interface Snippet {
  id: string;
  title: string;
  category: 'Estruturas de Dados' | 'Algoritmos' | 'Maratona & OBI';
  language: 'c' | 'python';
  filename: string;
  timeComplexity: string;
  spaceComplexity: string;
  description: string;
  code: string;
}

const SNIPPET_CATALOG: Snippet[] = [
  {
    id: 'c-bst',
    title: 'Árvore Binária de Busca (BST)',
    category: 'Estruturas de Dados',
    language: 'c',
    filename: 'arvore_binaria.c',
    timeComplexity: 'O(log N) médio / O(N) pior caso',
    spaceComplexity: 'O(N)',
    description: 'Implementação completa em C de inserção, busca recursiva e percurso em-ordem (in-order).',
    code: `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int val;
    struct Node *left;
    struct Node *right;
} Node;

Node* createNode(int val) {
    Node* n = (Node*)malloc(sizeof(Node));
    n->val = val;
    n->left = n->right = NULL;
    return n;
}

Node* insert(Node* root, int val) {
    if (!root) return createNode(val);
    if (val < root->val) root->left = insert(root->left, val);
    else if (val > root->val) root->right = insert(root->right, val);
    return root;
}

void inOrder(Node* root) {
    if (!root) return;
    inOrder(root->left);
    printf("%d ", root->val);
    inOrder(root->right);
}

int main() {
    Node* root = NULL;
    int values[] = {50, 30, 20, 40, 70, 60, 80};
    for (int i = 0; i < 7; i++) {
        root = insert(root, values[i]);
    }
    printf("Percurso Em-Ordem: ");
    inOrder(root);
    printf("\\n");
    return 0;
}
`,
  },
  {
    id: 'c-quicksort',
    title: 'QuickSort com Particionamento Lomuto',
    category: 'Algoritmos',
    language: 'c',
    filename: 'quicksort.c',
    timeComplexity: 'O(N log N) médio / O(N²) pior caso',
    spaceComplexity: 'O(log N)',
    description: 'Algoritmo de divisão e conquista in-place para ordenação de vetores em C.',
    code: `#include <stdio.h>

void swap(int *a, int *b) {
    int t = *a;
    *a = *b;
    *b = t;
}

int partition(int arr[], int low, int high) {
    int pivot = arr[high];
    int i = low - 1;
    for (int j = low; j < high; j++) {
        if (arr[j] <= pivot) {
            i++;
            swap(&arr[i], &arr[j]);
        }
    }
    swap(&arr[i + 1], &arr[high]);
    return i + 1;
}

void quickSort(int arr[], int low, int high) {
    if (low < high) {
        int pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}

int main() {
    int arr[] = {64, 25, 12, 22, 11, 90};
    int n = sizeof(arr) / sizeof(arr[0]);
    quickSort(arr, 0, n - 1);
    printf("Vetor Ordenado: ");
    for (int i = 0; i < n; i++) printf("%d ", arr[i]);
    printf("\\n");
    return 0;
}
`,
  },
  {
    id: 'py-dijkstra',
    title: 'Dijkstra (Caminho Mínimo com Heap)',
    category: 'Algoritmos',
    language: 'python',
    filename: 'dijkstra.py',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V + E)',
    description: 'Busca de caminho mínimo em grafos ponderados com heapq em Python.',
    code: `import heapq

def dijkstra(grafo, inicio):
    distancias = {vertice: float('inf') for vertice in grafo}
    distancias[inicio] = 0
    fila_prioridade = [(0, inicio)]

    while fila_prioridade:
        dist_atual, vertice_atual = heapq.heappop(fila_prioridade)

        if dist_atual > distancias[vertice_atual]:
            continue

        for vizinho, peso in grafo[vertice_atual]:
            distancia = dist_atual + peso
            if distancia < distancias[vizinho]:
                distancias[vizinho] = distancia
                heapq.heappush(fila_prioridade, (distancia, vizinho))

    return distancias

if __name__ == "__main__":
    grafo = {
        'A': [('B', 4), ('C', 2)],
        'B': [('A', 4), ('C', 1), ('D', 5)],
        'C': [('A', 2), ('B', 1), ('D', 8), ('E', 10)],
        'D': [('B', 5), ('C', 8), ('E', 2)],
        'E': [('C', 10), ('D', 2)]
    }
    resultado = dijkstra(grafo, 'A')
    print("Distâncias mínimas a partir de A:")
    for v, d in resultado.items():
        print(f" -> {v}: {d}")
`,
  },
  {
    id: 'c-maratona-io',
    title: 'Template OBI / Beecrowd (Leitura Rápida)',
    category: 'Maratona & OBI',
    language: 'c',
    filename: 'template_obi.c',
    timeComplexity: 'O(N)',
    spaceComplexity: 'O(1)',
    description: 'Estrutura padrão para submissões em juízes online com scanf em loop EOF.',
    code: `#include <stdio.h>

int main() {
    int a, b;
    // Loop de múltiplos casos de teste até o Fim do Arquivo (EOF)
    while (scanf("%d %d", &a, &b) == 2) {
        int soma = a + b;
        printf("%d\\n", soma);
    }
    return 0;
}
`,
  },
];

interface SnippetLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnippetLibraryModal: React.FC<SnippetLibraryModalProps> = ({ isOpen, onClose }) => {
  const { createNewFile } = useEditor();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = ['Todas', 'Estruturas de Dados', 'Algoritmos', 'Maratona & OBI'];

  const filtered = selectedCategory === 'Todas'
    ? SNIPPET_CATALOG
    : SNIPPET_CATALOG.filter((s) => s.category === selectedCategory);

  const handleCopy = async (snippet: Snippet) => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopiedId(snippet.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Erro ao copiar snippet:', err);
    }
  };

  const handleCreateFile = async (snippet: Snippet) => {
    await createNewFile(snippet.filename, false, null, snippet.code);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6">
      <div className="w-full max-w-3xl max-h-[85vh] bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#3e3e42] rounded-xl shadow-2xl text-[#333333] dark:text-[#cccccc] overflow-hidden flex flex-col transition-colors">
        {/* Cabeçalho */}
        <div className="h-12 px-5 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#333333] shrink-0 bg-[#fafafa] dark:bg-[#202021]">
          <div className="flex items-center space-x-2.5">
            <BookOpen className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
            <h2 className="text-sm font-bold text-black dark:text-white">
              Catálogo Didático de Algoritmos & Estruturas
            </h2>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium">
              Templates Educacionais
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[#ececec] dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="flex items-center space-x-2 px-5 py-2.5 bg-[#f5f5f5] dark:bg-[#1e1e1e] border-b border-[#e5e5e5] dark:border-[#333333] text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#007acc] text-white'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Lista de Snippets */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {filtered.map((snip) => (
            <div
              key={snip.id}
              className="p-4 rounded-xl border border-[#e5e5e5] dark:border-[#333333] bg-[#fafafa] dark:bg-[#1c1c1c] space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-black dark:text-white text-sm">{snip.title}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {snip.language}
                    </span>
                  </div>
                  <p className="text-[#666666] dark:text-[#999999] text-xs mt-1">{snip.description}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopy(snip)}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-black dark:text-white text-[11px] font-medium cursor-pointer transition-colors"
                  >
                    {copiedId === snip.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleCreateFile(snip)}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#007acc] hover:bg-[#0062a3] text-white text-[11px] font-medium cursor-pointer transition-colors shadow-xs"
                  >
                    <FilePlus className="w-3 h-3" />
                    <span>Criar {snip.filename}</span>
                  </button>
                </div>
              </div>

              {/* Informações Didáticas de Complexidade */}
              <div className="flex items-center space-x-4 text-[11px] pt-1">
                <span className="text-[#666666] dark:text-[#888888]">
                  Tempo: <strong className="text-black dark:text-white font-mono">{snip.timeComplexity}</strong>
                </span>
                <span className="text-[#666666] dark:text-[#888888]">
                  Espaço: <strong className="text-black dark:text-white font-mono">{snip.spaceComplexity}</strong>
                </span>
              </div>

              {/* Bloco de Código Preview */}
              <div className="max-h-40 overflow-y-auto p-3 rounded-lg bg-neutral-900 text-neutral-200 font-mono text-[11px] border border-neutral-800">
                <pre>{snip.code}</pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
