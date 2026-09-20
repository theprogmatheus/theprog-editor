export interface CSnippet {
  label: string;
  prefix: string;
  description: string;
  body: string;
  header?: string;
}

export const C_SNIPPETS: CSnippet[] = [
  {
    label: 'main (com argumentos)',
    prefix: 'main',
    description: 'Esqueleto padrão da função principal int main(int argc, char *argv[])',
    body: 'int main(int argc, char *argv[]) {\n\t${0:// Seu código aqui}\n\treturn 0;\n}',
  },
  {
    label: 'main (sem argumentos)',
    prefix: 'mainv',
    description: 'Função principal int main(void)',
    body: 'int main(void) {\n\t${0:// Seu código aqui}\n\treturn 0;\n}',
  },
  {
    label: 'for loop',
    prefix: 'for',
    description: 'Laço de repetição for padrão incremental',
    body: 'for (int ${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {\n\t${0}\n}',
  },
  {
    label: 'for loop (reverso)',
    prefix: 'forr',
    description: 'Laço de repetição for decrescente',
    body: 'for (int ${1:i} = ${2:count} - 1; ${1:i} >= 0; ${1:i}--) {\n\t${0}\n}',
  },
  {
    label: 'while loop',
    prefix: 'while',
    description: 'Laço condicional while',
    body: 'while (${1:condition}) {\n\t${0}\n}',
  },
  {
    label: 'do-while loop',
    prefix: 'dowhile',
    description: 'Laço condicional do-while (executa ao menos uma vez)',
    body: 'do {\n\t${0}\n} while (${1:condition});',
  },
  {
    label: 'if statement',
    prefix: 'if',
    description: 'Estrutura condicional simples if',
    body: 'if (${1:condition}) {\n\t${0}\n}',
  },
  {
    label: 'if-else statement',
    prefix: 'ife',
    description: 'Estrutura condicional if com bloco else',
    body: 'if (${1:condition}) {\n\t${2}\n} else {\n\t${0}\n}',
  },
  {
    label: 'switch statement',
    prefix: 'switch',
    description: 'Estrutura de seleção múltipla switch com case e default',
    body: 'switch (${1:expression}) {\n\tcase ${2:value}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\t${0}\n\t\tbreak;\n}',
  },
  {
    label: 'struct declaration',
    prefix: 'struct',
    description: 'Declaração de estrutura struct',
    body: 'struct ${1:NomeDaStruct} {\n\t${2:/* membros */}\n};',
  },
  {
    label: 'typedef struct declaration',
    prefix: 'typedef_struct',
    description: 'Declaração de struct com typedef (apelido de tipo)',
    body: 'typedef struct {\n\t${2:/* membros */}\n} ${1:NomeDoTipo};',
  },
  {
    label: 'printf com quebra de linha',
    prefix: 'printf',
    header: 'stdio.h',
    description: 'Chamada formatada de saída printf com quebra de linha',
    body: 'printf("${1:%s}\\n", ${2:var});${0}',
  },
  {
    label: 'scanf leitura de variável',
    prefix: 'scanf',
    header: 'stdio.h',
    description: 'Chamada de entrada formatada scanf com passagem por referência (&)',
    body: 'scanf("${1:%d}", &${2:var});${0}',
  },
  {
    label: '#include <...>',
    prefix: 'inc',
    description: 'Inclusão de cabeçalho de biblioteca do sistema (#include <...>)',
    body: '#include <${1:stdio.h}>${0}',
  },
  {
    label: '#include "..."',
    prefix: 'incl',
    description: 'Inclusão de cabeçalho de arquivo local do projeto (#include "...")',
    body: '#include "${1:arquivo.h}"${0}',
  },
  {
    label: '#define constante',
    prefix: 'def',
    description: 'Definição de macro constante (#define NOME VALOR)',
    body: '#define ${1:NOME} ${2:VALOR}${0}',
  },
  {
    label: 'função com retorno',
    prefix: 'fun',
    description: 'Declaração e corpo de função C',
    body: '${1:int} ${2:nomeDaFuncao}(${3:void}) {\n\t${0}\n\treturn ${4:0};\n}',
  },
  {
    label: 'função void',
    prefix: 'funv',
    description: 'Declaração e corpo de função sem retorno (void)',
    body: 'void ${1:nomeDaFuncao}(${2:void}) {\n\t${0}\n}',
  },
  {
    label: 'alocação malloc com verificação NULL',
    prefix: 'malloc',
    header: 'stdlib.h',
    description: 'Alocação dinâmica na heap com teste de segurança NULL',
    body: '${1:int} *${2:ptr} = (${1:int} *)malloc(${3:size} * sizeof(${1:int}));\nif (${2:ptr} == NULL) {\n\tfprintf(stderr, "Erro de alocação de memória!\\n");\n\texit(1);\n}\n${0}',
  },
  {
    label: 'abertura fopen com verificação NULL',
    prefix: 'fopen',
    header: 'stdio.h',
    description: 'Abertura de arquivo com verificação de ponteiro FILE válido',
    body: 'FILE *${1:file} = fopen("${2:arquivo.txt}", "${3:r}");\nif (${1:file} == NULL) {\n\tperror("Erro ao abrir arquivo");\n\t${0}\n}',
  },
];
