export interface PythonSnippet {
  label: string;
  description: string;
  body: string;
}

export const PYTHON_KEYWORDS = [
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'False',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'None',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'True',
  'try',
  'while',
  'with',
  'yield',
];

export const PYTHON_SNIPPETS: PythonSnippet[] = [
  {
    label: 'if',
    description: 'Estrutura condicional if',
    body: 'if ${1:condição}:\n\t${0:pass}',
  },
  {
    label: 'ifelse',
    description: 'Estrutura condicional if/else',
    body: 'if ${1:condição}:\n\t${2:pass}\nelse:\n\t${0:pass}',
  },
  {
    label: 'elif',
    description: 'Estrutura condicional if/elif/else',
    body: 'if ${1:condição}:\n\t${2:pass}\nelif ${3:outra_condição}:\n\t${4:pass}\nelse:\n\t${0:pass}',
  },
  {
    label: 'for',
    description: 'Laço for com range()',
    body: 'for ${1:i} in range(${2:0}, ${3:10}):\n\t${0:pass}',
  },
  {
    label: 'forin',
    description: 'Laço for percorrendo uma sequência',
    body: 'for ${1:item} in ${2:sequência}:\n\t${0:pass}',
  },
  {
    label: 'while',
    description: 'Laço while',
    body: 'while ${1:condição}:\n\t${0:pass}',
  },
  {
    label: 'def',
    description: 'Definição de função',
    body: 'def ${1:nome}(${2:parametros}):\n\t${0:pass}',
  },
  {
    label: 'class',
    description: 'Definição de classe com __init__',
    body: 'class ${1:Nome}:\n\tdef __init__(self${2:, args}):\n\t\t${0:pass}',
  },
  {
    label: 'main',
    description: 'Bloco principal com guarda __main__',
    body: 'def main():\n\t${1:pass}\n\n\nif __name__ == "__main__":\n\tmain()',
  },
  {
    label: 'input',
    description: 'Leitura de entrada do usuário',
    body: '${1:variavel} = input("${2:Digite um valor: }")',
  },
  {
    label: 'print',
    description: 'Impressão formatada',
    body: 'print(f"${1:resultado = }")',
  },
  {
    label: 'try',
    description: 'Tratamento de exceções try/except',
    body: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:erro}:\n\t${0:print(erro)}',
  },
  {
    label: 'withopen',
    description: 'Leitura de arquivo com with open',
    body: 'with open("${1:arquivo.txt}", "${2:r}", encoding="utf-8") as ${3:arquivo}:\n\t${0:conteudo = arquivo.read()}',
  },
  {
    label: 'withwrite',
    description: 'Escrita em arquivo com with open',
    body: 'with open("${1:saida.txt}", "w", encoding="utf-8") as ${2:arquivo}:\n\t${0:arquivo.write("texto")}',
  },
  {
    label: 'listcomp',
    description: 'List comprehension',
    body: '${1:nova_lista} = [${2:expr} for ${3:item} in ${4:sequência}${5: if condição}]',
  },
  {
    label: 'lambda',
    description: 'Função anônima (lambda)',
    body: '${1:funcao} = lambda ${2:x}: ${0:x}',
  },
  {
    label: 'dict',
    description: 'Dicionário',
    body: '${1:dados} = {\n\t"${2:chave}": ${3:valor},\n}',
  },
];
