import type * as Monaco from 'monaco-editor';
import {
  analyzeCSymbols,
  getSymbolsInScope,
  resolveStructMembers,
  resolveIncludedSymbols,
  type CSymbolStruct,
  type CSymbolVariable,
} from './cSymbolAnalyzer';
import {
  C_KEYWORDS,
  C_STANDARD_HEADERS,
  C_STDLIB_SYMBOLS,
} from './cStdLibCatalog';
import { C_SNIPPETS } from './cSnippets';
import {
  CPP_KEYWORDS,
  CPP_STANDARD_HEADERS,
  CPP_STDLIB_SYMBOLS,
} from './cppStdLibCatalog';
import { CPP_SNIPPETS } from './cppSnippets';

export type WorkspaceFileItem = { name: string; content?: string; path?: string };
export type WorkspaceFilesProvider = () => WorkspaceFileItem[];

let globalWorkspaceFilesProvider: WorkspaceFilesProvider | null = null;

/**
 * Permite ao EditorContext registrar um provedor para consulta dos arquivos do projeto,
 * possibilitando a resolução de #include "arquivo.h" mesmo para arquivos que não estão abertos no momento.
 */
export function setWorkspaceFilesProvider(provider: WorkspaceFilesProvider | null): void {
  globalWorkspaceFilesProvider = provider;
}

/**
 * Mapeamento entre cabeçalhos C clássicos e suas versões C++ no namespace std
 */
const C_TO_CPP_HEADER_MAP: Record<string, string> = {
  'stdio.h': 'cstdio',
  'stdlib.h': 'cstdlib',
  'string.h': 'cstring',
  'math.h': 'cmath',
  'time.h': 'ctime',
  'assert.h': 'cassert',
  'ctype.h': 'cctype',
};

const CPP_TO_C_HEADER_MAP: Record<string, string> = {
  cstdio: 'stdio.h',
  cstdlib: 'stdlib.h',
  cstring: 'string.h',
  cmath: 'math.h',
  ctime: 'time.h',
  cassert: 'assert.h',
  cctype: 'ctype.h',
};

/**
 * Verifica se determinado cabeçalho padrão está incluído, considerando equivalências C/C++ (ex: <stdio.h> <-> <cstdio>)
 */
export function isHeaderIncluded(
  header: string | undefined,
  systemHeaders: Set<string>,
  isCpp: boolean
): boolean {
  if (!header) return true;
  if (systemHeaders.has(header)) return true;
  if (isCpp) {
    const cppEquivalent = C_TO_CPP_HEADER_MAP[header];
    if (cppEquivalent && systemHeaders.has(cppEquivalent)) return true;
    const cEquivalent = CPP_TO_C_HEADER_MAP[header];
    if (cEquivalent && systemHeaders.has(cEquivalent)) return true;
  }
  return false;
}

/**
 * Detecta se o modelo atual deve ser tratado como C++ (.cpp, .cc, .cxx, .hpp)
 * ou como C puro (.c).
 */
export function isCppMode(model: Monaco.editor.ITextModel): boolean {
  const path = (model.uri.path || '').toLowerCase();
  if (path.endsWith('.cpp') || path.endsWith('.cc') || path.endsWith('.cxx') || path.endsWith('.hpp')) {
    return true;
  }
  if (path.endsWith('.c')) {
    return false;
  }
  const langId = model.getLanguageId();
  if (langId === 'c') {
    return false;
  }
  if (langId === 'cpp') {
    if (path.endsWith('.h')) {
      const code = model.getValue();
      // Marcadores explícitos de C++
      if (
        /\b(class|template|namespace|public:|private:|protected:|std::|nullptr|cout|cin)\b/.test(code) ||
        (/#\s*include\s*<[a-z_]+>/.test(code) && !/#\s*include\s*<[a-z_]+\.h>/.test(code))
      ) {
        return true;
      }
      if (globalWorkspaceFilesProvider) {
        const files = globalWorkspaceFilesProvider();
        const hasCpp = files.some(
          (f) => f.name.endsWith('.cpp') || f.name.endsWith('.cc') || f.name.endsWith('.hpp')
        );
        const hasC = files.some((f) => f.name.endsWith('.c'));
        if (hasC && !hasCpp) return false;
      }
    }
    return true;
  }
  return false;
}

const symbolCache = new WeakMap<
  Monaco.editor.ITextModel,
  { versionId: number; symbols: ReturnType<typeof analyzeCSymbols> }
>();

function getCachedCSymbols(model: Monaco.editor.ITextModel): ReturnType<typeof analyzeCSymbols> {
  const versionId = model.getVersionId();
  const cached = symbolCache.get(model);
  if (cached && cached.versionId === versionId) {
    return cached.symbols;
  }
  const symbols = analyzeCSymbols(model.getValue());
  symbolCache.set(model, { versionId, symbols });
  return symbols;
}

/**
 * Tenta obter o conteúdo de um arquivo de cabeçalho consultando primeiro
 * os arquivos do Workspace e, em seguida, os modelos abertos no Monaco Editor.
 */
function getHeaderContent(headerName: string, monacoInstance: typeof Monaco): string | undefined {
  const cleanName = headerName.replace(/^\.\//, '').trim();

  // 1. Procura nos arquivos fornecidos pelo Workspace
  if (globalWorkspaceFilesProvider) {
    const files = globalWorkspaceFilesProvider();
    const found = files.find(
      (f) => f.name === cleanName || f.name.endsWith('/' + cleanName) || (f.path && f.path.endsWith(cleanName))
    );
    if (found && typeof found.content === 'string') {
      return found.content;
    }
  }

  // 2. Procura nos modelos abertos no Monaco Editor
  const models = monacoInstance.editor.getModels();
  for (const m of models) {
    const p = m.uri.path;
    const filename = p.split('/').pop() || '';
    if (filename === cleanName || p.endsWith('/' + cleanName)) {
      return m.getValue();
    }
  }

  return undefined;
}

let isRegistered = false;

/**
 * Registra todos os recursos de linguagem inteligentes para C e C++ no Monaco Editor:
 * - Identificação automática de C (.c) vs C++ (.cpp, .hpp)
 * - Autocomplete estritamente separado por linguagem (palavras-chave C vs C++, snippets C vs C++)
 * - Biblioteca padrão e STL (iostream, vector, string, map, algorithm) estritamente filtrada por #include
 * - Suporte especial a 'using namespace std;' e ao gatilho 'std::'
 * - Resolução de membros (. e ->) para structs C, classes C++ e contêineres STL (vector, string, map, etc.)
 * - Resolução e importação de símbolos de cabeçalhos próprios (#include "meu_header.h" / .hpp)
 * - Hover tooltips contextualizados com avisos de inclusão necessária
 * - Signature Help para funções C, métodos C++ e biblioteca padrão/STL
 */
export function registerCLanguageService(monaco: typeof Monaco): void {
  if (isRegistered) return;
  isRegistered = true;

  const supportedLanguages = ['c', 'cpp'];

  // 1. Configuração de Sintaxe e Pareamento de Caracteres
  for (const lang of supportedLanguages) {
    monaco.languages.setLanguageConfiguration(lang, {
      comments: {
        lineComment: '//',
        blockComment: ['/*', '*/'],
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string', 'comment'] },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g,
    });
  }

  // 2. Provedor de Completamento Inteligente (Ctrl+Space e Digitação)
  for (const lang of supportedLanguages) {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['.', '>', ':', '#', '<', '"'],
      provideCompletionItems: (model, position) => {
        const isCpp = isCppMode(model);
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        const word = model.getWordUntilPosition(position);

        const range: Monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: Monaco.languages.CompletionItem[] = [];

        // A. Autocomplete de Cabeçalhos em #include <...>
        if (/#include\s*<[^>]*$/.test(textBeforeCursor)) {
          if (isCpp) {
            for (const header of CPP_STANDARD_HEADERS) {
              suggestions.push({
                label: header.name,
                kind: monaco.languages.CompletionItemKind.Module,
                detail: `(cabeçalho C++) <${header.name}>`,
                documentation: { value: header.description },
                insertText: header.name,
                range,
                sortText: `00_${header.name}`,
              });
            }
            for (const header of C_STANDARD_HEADERS) {
              suggestions.push({
                label: header.name,
                kind: monaco.languages.CompletionItemKind.Module,
                detail: `(cabeçalho C) <${header.name}>`,
                documentation: { value: header.description },
                insertText: header.name,
                range,
                sortText: `01_${header.name}`,
              });
            }
          } else {
            for (const header of C_STANDARD_HEADERS) {
              suggestions.push({
                label: header.name,
                kind: monaco.languages.CompletionItemKind.Module,
                detail: `(cabeçalho C) <${header.name}>`,
                documentation: { value: header.description },
                insertText: header.name,
                range,
                sortText: `00_${header.name}`,
              });
            }
          }
          return { suggestions };
        }

        // B. Autocomplete de Arquivos de Projeto em #include "..."
        if (/#include\s*"[^"]*$/.test(textBeforeCursor)) {
          const files = globalWorkspaceFilesProvider ? globalWorkspaceFilesProvider() : [];
          const projectFiles = new Set<string>();

          for (const f of files) {
            if (
              f.name.endsWith('.h') ||
              f.name.endsWith('.c') ||
              (isCpp && (f.name.endsWith('.hpp') || f.name.endsWith('.cpp') || f.name.endsWith('.cc')))
            ) {
              projectFiles.add(f.name);
            }
          }

          const allModels = monaco.editor.getModels();
          for (const m of allModels) {
            const path = m.uri.path;
            const filename = path.split('/').pop() || '';
            if (
              filename.endsWith('.h') ||
              filename.endsWith('.c') ||
              (isCpp && (filename.endsWith('.hpp') || filename.endsWith('.cpp') || filename.endsWith('.cc')))
            ) {
              projectFiles.add(filename);
            }
          }

          for (const filename of projectFiles) {
            suggestions.push({
              label: filename,
              kind: monaco.languages.CompletionItemKind.File,
              detail: `(arquivo do projeto) "${filename}"`,
              insertText: filename,
              range,
              sortText: `00_${filename}`,
            });
          }
          return { suggestions };
        }

        // C. Autocomplete de Diretivas de Pré-processador (#)
        if (/^\s*#\w*$/.test(textBeforeCursor)) {
          const defaultHeader = isCpp ? 'iostream' : 'stdio.h';
          const directives = [
            { name: 'include', desc: 'Inclui um arquivo de cabeçalho', snippet: `include <\${1:${defaultHeader}}>` },
            { name: 'define', desc: 'Define uma constante ou macro', snippet: 'define ${1:NOME} ${2:VALOR}' },
            { name: 'ifdef', desc: 'Compilação condicional se macro estiver definida', snippet: 'ifdef ${1:MACRO}\n\t$0\n#endif' },
            { name: 'ifndef', desc: 'Compilação condicional se macro não estiver definida (include guards)', snippet: 'ifndef ${1:HEADER_H}\n#define ${1:HEADER_H}\n\n$0\n\n#endif' },
            { name: 'endif', desc: 'Encerra bloco condicional de pré-processador', snippet: 'endif' },
            { name: 'pragma', desc: 'Diretiva de compilador específica', snippet: 'pragma once' },
          ];
          for (const d of directives) {
            suggestions.push({
              label: `#${d.name}`,
              kind: monaco.languages.CompletionItemKind.Keyword,
              detail: `(pré-processador) #${d.name}`,
              documentation: { value: d.desc },
              insertText: d.snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `00_${d.name}`,
            });
          }
          return { suggestions };
        }

        const sourceCode = model.getValue();
        const symbols = getCachedCSymbols(model);
        const resolvedIncludes = resolveIncludedSymbols(sourceCode, (name) => getHeaderContent(name, monaco));

        // D. Autocomplete Especial C++ após 'std::'
        if (isCpp) {
          const isStdScope = /(?:^|[^A-Za-z0-9_])std::([A-Za-z0-9_]*)$/.test(textBeforeCursor);
          if (isStdScope) {
            for (const std of CPP_STDLIB_SYMBOLS) {
              if (!isHeaderIncluded(std.header, resolvedIncludes.systemHeaders, true)) {
                continue;
              }

              let kind = monaco.languages.CompletionItemKind.Function;
              let insertSnippet = std.name;
              let hasSnippet = false;

              if (std.kind === 'constant') {
                kind = monaco.languages.CompletionItemKind.Constant;
              } else if (std.kind === 'type') {
                kind = monaco.languages.CompletionItemKind.Class;
                if (['vector', 'map', 'unordered_map', 'set', 'unordered_set', 'queue', 'stack', 'deque', 'unique_ptr', 'shared_ptr', 'optional'].includes(std.name)) {
                  insertSnippet = `${std.name}<\${1:T}>`;
                  hasSnippet = true;
                }
              } else if (std.kind === 'function') {
                kind = monaco.languages.CompletionItemKind.Function;
                if (std.parameters && std.parameters.length > 0) {
                  const pStr = std.parameters.map((p, idx) => `\${${idx + 1}:${p.name}}`).join(', ');
                  insertSnippet = `${std.name}(${pStr})`;
                  hasSnippet = true;
                } else {
                  insertSnippet = `${std.name}()`;
                  hasSnippet = true;
                }
              }

              const headerInfo = std.header ? `<${std.header}>` : '';
              suggestions.push({
                label: std.name,
                kind,
                detail: `(std::) ${std.signature || std.name} ${headerInfo}`,
                documentation: {
                  value: `**std::${std.name}** ${headerInfo}\n\n\`\`\`cpp\n${std.signature || std.name}\n\`\`\`\n\n${std.description}`,
                },
                insertText: insertSnippet,
                insertTextRules: hasSnippet
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
                range,
                sortText: `00_${std.name}`,
              });
            }
            return { suggestions };
          }
        }

        // E. Resolução de Membros de Struct/Classe e Métodos STL (. e ->)
        const extraStructs: CSymbolStruct[] = resolvedIncludes.userHeaders.flatMap((h) => h.symbols.structs);
        const extraVars: CSymbolVariable[] = resolvedIncludes.userHeaders.flatMap((h) =>
          h.symbols.variables.filter((v) => v.scope === 'global')
        );

        const memberAccessMatch = textBeforeCursor.match(/([A-Za-z_][A-Za-z0-9_]*)(?:\.|->)$/);
        if (memberAccessMatch) {
          const varName = memberAccessMatch[1];
          const fields = resolveStructMembers(varName, symbols, position.lineNumber, extraStructs, extraVars);
          if (fields && fields.length > 0) {
            for (const f of fields) {
              const isMethod = f.name.includes('(');
              suggestions.push({
                label: f.name,
                kind: isMethod ? monaco.languages.CompletionItemKind.Method : monaco.languages.CompletionItemKind.Field,
                detail: `(${isMethod ? 'método' : 'campo'}) ${f.type} ${f.name}`,
                documentation: {
                  value: (f as any).doc || `Membro da estrutura/classe associada a \`${varName}\`.`,
                },
                insertText: isMethod ? f.name.replace(/\([^)]*\)/, '($0)') : f.name,
                insertTextRules: isMethod
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
                range,
                sortText: `00_${f.name}`,
              });
            }
            return { suggestions };
          }
        }

        // F. Sugestões de Escopo: Variáveis Locais, Parâmetros e Globais do Arquivo Atual
        const inScope = getSymbolsInScope(symbols, position.lineNumber);

        // 1. Variáveis locais e parâmetros (Maior prioridade: topo absoluto no Ctrl+Space)
        for (const v of inScope.localVars) {
          const scopeLabel = v.scope === 'param' ? 'parâmetro' : 'variável local';
          suggestions.push({
            label: v.name,
            kind: monaco.languages.CompletionItemKind.Variable,
            detail: `(${scopeLabel}) ${v.type} ${v.name}`,
            documentation: {
              value: `**${v.name}**\n\nTipo: \`${v.type}\`\n\nEscopo: ${scopeLabel}\n\nLinha de declaração: ${v.line}`,
            },
            insertText: v.name,
            range,
            sortText: `00_${v.name}`,
          });
        }

        // 2. Funções definidas no arquivo atual
        for (const f of inScope.functions) {
          const paramPlaceholders = f.parameters.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ');
          suggestions.push({
            label: f.name,
            kind: monaco.languages.CompletionItemKind.Function,
            detail: `(função) ${f.signature}`,
            documentation: {
              value: `**Função:** \`${f.signature}\`\n\nRetorno: \`${f.returnType}\`\n\nLinha: ${f.line}`,
            },
            insertText: `${f.name}(${paramPlaceholders})`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: `01_${f.name}`,
          });
        }

        // 3. Variáveis globais do arquivo atual
        for (const v of inScope.globalVars) {
          suggestions.push({
            label: v.name,
            kind: monaco.languages.CompletionItemKind.Variable,
            detail: `(variável global) ${v.type} ${v.name}`,
            documentation: {
              value: `**${v.name}**\n\nTipo: \`${v.type}\`\n\nEscopo: global\n\nLinha: ${v.line}`,
            },
            insertText: v.name,
            range,
            sortText: `02_${v.name}`,
          });
        }

        // 4. Structs, Classes e Macros definidas no arquivo atual
        for (const s of inScope.structs) {
          suggestions.push({
            label: s.name,
            kind: isCpp ? monaco.languages.CompletionItemKind.Class : monaco.languages.CompletionItemKind.Struct,
            detail: `(${isCpp ? 'tipo/classe' : 'struct'}) ${s.name}`,
            documentation: {
              value: `**${isCpp ? 'Tipo/Classe' : 'Estrutura'}:** \`${s.name}\`\n\nCampos/Membros:\n${s.fields.map((f) => `- \`${f.type} ${f.name}\``).join('\n')}`,
            },
            insertText: s.name,
            range,
            sortText: `03_${s.name}`,
          });
        }

        for (const m of inScope.macros) {
          suggestions.push({
            label: m.name,
            kind: monaco.languages.CompletionItemKind.Constant,
            detail: `(macro) #define ${m.name} ${m.value || ''}`,
            documentation: {
              value: `Macro definida na linha ${m.line}:\n\`#define ${m.name} ${m.value || ''}\``,
            },
            insertText: m.name,
            range,
            sortText: `03_${m.name}`,
          });
        }

        // 5. Símbolos de Headers Próprios Incluídos (#include "meu_header.h" / .hpp)
        for (const header of resolvedIncludes.userHeaders) {
          const hName = header.headerName;

          // Funções importadas do header
          for (const f of header.symbols.functions) {
            const paramPlaceholders = f.parameters.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ');
            suggestions.push({
              label: f.name,
              kind: monaco.languages.CompletionItemKind.Function,
              detail: `(função [${hName}]) ${f.signature}`,
              documentation: {
                value: `**Função:** \`${f.signature}\`\n\nOrigem: \`${hName}\` (linha ${f.line})\n\nRetorno: \`${f.returnType}\``,
              },
              insertText: `${f.name}(${paramPlaceholders})`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `01_${f.name}`,
            });
          }

          // Variáveis globais importadas do header
          for (const v of header.symbols.variables.filter((v) => v.scope === 'global')) {
            suggestions.push({
              label: v.name,
              kind: monaco.languages.CompletionItemKind.Variable,
              detail: `(variável [${hName}]) ${v.type} ${v.name}`,
              documentation: {
                value: `**${v.name}**\n\nTipo: \`${v.type}\`\n\nOrigem: \`${hName}\` (linha ${v.line})`,
              },
              insertText: v.name,
              range,
              sortText: `02_${v.name}`,
            });
          }

          // Structs / Classes importadas do header
          for (const s of header.symbols.structs) {
            suggestions.push({
              label: s.name,
              kind: isCpp ? monaco.languages.CompletionItemKind.Class : monaco.languages.CompletionItemKind.Struct,
              detail: `(${isCpp ? 'classe' : 'struct'} [${hName}]) ${s.name}`,
              documentation: {
                value: `**${isCpp ? 'Classe/Struct' : 'Estrutura'}:** \`${s.name}\` (de \`${hName}\`)\n\nCampos:\n${s.fields.map((f) => `- \`${f.type} ${f.name}\``).join('\n')}`,
              },
              insertText: s.name,
              range,
              sortText: `03_${s.name}`,
            });
          }

          // Macros importadas do header
          for (const m of header.symbols.macros) {
            suggestions.push({
              label: m.name,
              kind: monaco.languages.CompletionItemKind.Constant,
              detail: `(macro [${hName}]) #define ${m.name} ${m.value || ''}`,
              documentation: {
                value: `Macro definida em \`${hName}\` (linha ${m.line}):\n\`#define ${m.name} ${m.value || ''}\``,
              },
              insertText: m.name,
              range,
              sortText: `03_${m.name}`,
            });
          }
        }

        // 6. Biblioteca Padrão e STL - FILTRADA: APENAS BIBLIOTECAS QUE ESTÃO INCLUDED!
        if (isCpp) {
          const hasUsingNamespaceStd = /^\s*using\s+namespace\s+std\s*;/m.test(sourceCode);

          // A. Símbolos STL C++
          for (const std of CPP_STDLIB_SYMBOLS) {
            if (!isHeaderIncluded(std.header, resolvedIncludes.systemHeaders, true)) {
              continue;
            }

            let kind = monaco.languages.CompletionItemKind.Function;
            let baseSnippet = std.name;
            let hasSnippet = false;

            if (std.kind === 'constant') {
              kind = monaco.languages.CompletionItemKind.Constant;
            } else if (std.kind === 'type') {
              kind = monaco.languages.CompletionItemKind.Class;
              if (['vector', 'map', 'unordered_map', 'set', 'unordered_set', 'queue', 'stack', 'deque', 'unique_ptr', 'shared_ptr', 'optional'].includes(std.name)) {
                baseSnippet = `${std.name}<\${1:T}>`;
                hasSnippet = true;
              }
            } else if (std.kind === 'function') {
              kind = monaco.languages.CompletionItemKind.Function;
              if (std.parameters && std.parameters.length > 0) {
                const pStr = std.parameters.map((p, idx) => `\${${idx + 1}:${p.name}}`).join(', ');
                baseSnippet = `${std.name}(${pStr})`;
                hasSnippet = true;
              } else {
                baseSnippet = `${std.name}()`;
                hasSnippet = true;
              }
            }

            const headerInfo = std.header ? `<${std.header}>` : '';
            const docValue = `**std::${std.name}** ${headerInfo}\n\n\`\`\`cpp\n${std.signature || std.name}\n\`\`\`\n\n${std.description}`;

            if (hasUsingNamespaceStd) {
              // Com 'using namespace std;', sugere o nome simples diretamente no topo
              suggestions.push({
                label: std.name,
                kind,
                detail: `(std::) ${std.signature || std.name} ${headerInfo}`,
                documentation: { value: docValue },
                insertText: baseSnippet,
                insertTextRules: hasSnippet
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
                range,
                sortText: `04_${std.name}`,
              });

              // E também a versão qualificada com std::
              suggestions.push({
                label: `std::${std.name}`,
                kind,
                detail: `(namespace std) <${std.header}>`,
                documentation: { value: docValue },
                insertText: `std::${baseSnippet}`,
                insertTextRules: hasSnippet
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
                range,
                sortText: `04_z_${std.name}`,
              });
            } else {
              // Sem 'using namespace std;', sugere std::...
              suggestions.push({
                label: `std::${std.name}`,
                kind,
                detail: `(namespace std) <${std.header}>`,
                documentation: { value: docValue },
                insertText: `std::${baseSnippet}`,
                insertTextRules: hasSnippet
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
                range,
                sortText: `04_${std.name}`,
              });

              // Sugere também a busca pelo nome sem prefixo (mas insere std:: automaticamente)
              suggestions.push({
                label: std.name,
                kind,
                detail: `(std::) ${std.signature || std.name} (insere std::)`,
                documentation: { value: docValue },
                insertText: `std::${baseSnippet}`,
                insertTextRules: hasSnippet
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : undefined,
                range,
                sortText: `04_z_${std.name}`,
              });
            }
          }

          // B. Funções C padrão compatíveis com C++ (apenas se header C/C++ correspondente estiver incluído)
          for (const std of C_STDLIB_SYMBOLS) {
            if (!isHeaderIncluded(std.header, resolvedIncludes.systemHeaders, true)) {
              continue;
            }

            let kind = monaco.languages.CompletionItemKind.Function;
            let insertSnippet = std.name;
            let hasSnippet = false;

            if (std.kind === 'constant') kind = monaco.languages.CompletionItemKind.Constant;
            else if (std.kind === 'type') kind = monaco.languages.CompletionItemKind.Struct;
            else if (std.kind === 'function') {
              kind = monaco.languages.CompletionItemKind.Function;
              if (std.name === 'printf') {
                insertSnippet = 'printf("${1:%s}\\n", ${2:args})';
                hasSnippet = true;
              } else if (std.name === 'scanf') {
                insertSnippet = 'scanf("${1:%d}", &${2:var})';
                hasSnippet = true;
              } else if (std.parameters && std.parameters.length > 0) {
                const pStr = std.parameters.map((p, idx) => `\${${idx + 1}:${p.name}}`).join(', ');
                insertSnippet = `${std.name}(${pStr})`;
                hasSnippet = true;
              } else {
                insertSnippet = `${std.name}()`;
                hasSnippet = true;
              }
            }

            const headerInfo = std.header ? `<${std.header}>` : '';
            suggestions.push({
              label: std.name,
              kind,
              detail: `(C stdlib) ${std.signature || std.name} ${headerInfo}`,
              documentation: {
                value: `**${std.name}** ${headerInfo}\n\n\`\`\`c\n${std.signature || std.name}\n\`\`\`\n\n${std.description}`,
              },
              insertText: insertSnippet,
              insertTextRules: hasSnippet
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              range,
              sortText: `04_c_${std.name}`,
            });
          }
        } else {
          // Modo C puro: Apenas símbolos da libc clássica
          for (const std of C_STDLIB_SYMBOLS) {
            if (!isHeaderIncluded(std.header, resolvedIncludes.systemHeaders, false)) {
              continue;
            }

            let kind = monaco.languages.CompletionItemKind.Function;
            let insertSnippet = std.name;
            let hasSnippet = false;

            if (std.kind === 'constant') kind = monaco.languages.CompletionItemKind.Constant;
            else if (std.kind === 'type') kind = monaco.languages.CompletionItemKind.Struct;
            else if (std.kind === 'function') {
              kind = monaco.languages.CompletionItemKind.Function;
              if (std.name === 'printf') {
                insertSnippet = 'printf("${1:%s}\\n", ${2:args})';
                hasSnippet = true;
              } else if (std.name === 'scanf') {
                insertSnippet = 'scanf("${1:%d}", &${2:var})';
                hasSnippet = true;
              } else if (std.parameters && std.parameters.length > 0) {
                const pStr = std.parameters.map((p, idx) => `\${${idx + 1}:${p.name}}`).join(', ');
                insertSnippet = `${std.name}(${pStr})`;
                hasSnippet = true;
              } else {
                insertSnippet = `${std.name}()`;
                hasSnippet = true;
              }
            }

            const headerInfo = std.header ? `<${std.header}>` : '';
            const detail = std.signature ? `(${headerInfo}) ${std.signature}` : `(${headerInfo}) ${std.name}`;

            suggestions.push({
              label: std.name,
              kind,
              detail,
              documentation: {
                value: `**${std.name}** ${headerInfo}\n\n\`\`\`c\n${std.signature || std.name}\n\`\`\`\n\n${std.description}`,
              },
              insertText: insertSnippet,
              insertTextRules: hasSnippet
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              range,
              sortText: `04_${std.name}`,
            });
          }
        }

        // 7. Palavras-chave da Linguagem (C puro vs C++)
        if (isCpp) {
          const addedKeywords = new Set<string>();
          for (const kw of CPP_KEYWORDS) {
            addedKeywords.add(kw.name);
            suggestions.push({
              label: kw.name,
              kind: monaco.languages.CompletionItemKind.Keyword,
              detail: `(palavra-chave C++) ${kw.name}`,
              documentation: { value: kw.description },
              insertText: kw.name,
              range,
              sortText: `05_${kw.name}`,
            });
          }
          for (const kw of C_KEYWORDS) {
            if (!addedKeywords.has(kw.name)) {
              suggestions.push({
                label: kw.name,
                kind: monaco.languages.CompletionItemKind.Keyword,
                detail: `(palavra-chave) ${kw.name}`,
                documentation: { value: kw.description },
                insertText: kw.name,
                range,
                sortText: `05_${kw.name}`,
              });
            }
          }
        } else {
          for (const kw of C_KEYWORDS) {
            suggestions.push({
              label: kw.name,
              kind: monaco.languages.CompletionItemKind.Keyword,
              detail: `(palavra-chave) ${kw.name}`,
              documentation: { value: kw.description },
              insertText: kw.name,
              range,
              sortText: `05_${kw.name}`,
            });
          }
        }

        // 8. Snippets de Código (C puro vs C++)
        if (isCpp) {
          for (const snip of CPP_SNIPPETS) {
            if (snip.header && !isHeaderIncluded(snip.header, resolvedIncludes.systemHeaders, true)) {
              continue;
            }
            suggestions.push({
              label: snip.prefix,
              kind: monaco.languages.CompletionItemKind.Snippet,
              detail: `(snippet C++) ${snip.label}`,
              documentation: { value: snip.description },
              insertText: snip.body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `06_${snip.prefix}`,
            });
          }
          // Snippets de controle de fluxo de C compartilhados
          const sharedC = C_SNIPPETS.filter((s) => ['for', 'while', 'dowhile', 'ifelse', 'switchcase'].includes(s.prefix));
          for (const snip of sharedC) {
            suggestions.push({
              label: snip.prefix,
              kind: monaco.languages.CompletionItemKind.Snippet,
              detail: `(snippet) ${snip.label}`,
              documentation: { value: snip.description },
              insertText: snip.body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `06_z_${snip.prefix}`,
            });
          }
        } else {
          for (const snip of C_SNIPPETS) {
            if (snip.header && !isHeaderIncluded(snip.header, resolvedIncludes.systemHeaders, false)) {
              continue;
            }
            suggestions.push({
              label: snip.prefix,
              kind: monaco.languages.CompletionItemKind.Snippet,
              detail: `(snippet) ${snip.label}`,
              documentation: { value: snip.description },
              insertText: snip.body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              sortText: `06_${snip.prefix}`,
            });
          }
        }

        return { suggestions };
      },
    });
  }

  // 3. Provedor de Hover (Tooltips informativos ao passar o mouse)
  for (const lang of supportedLanguages) {
    monaco.languages.registerHoverProvider(lang, {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const symbolName = word.word;
        const isCpp = isCppMode(model);
        const sourceCode = model.getValue();
        const symbols = getCachedCSymbols(model);
        const resolvedIncludes = resolveIncludedSymbols(sourceCode, (name) => getHeaderContent(name, monaco));
        const inScope = getSymbolsInScope(symbols, position.lineNumber);

        // A. Variáveis locais e parâmetros
        const local = inScope.localVars.find((v) => v.name === symbolName);
        if (local) {
          const scopeLabel = local.scope === 'param' ? 'parâmetro' : 'variável local';
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [
              { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n(${scopeLabel}) ${local.type} ${local.name}\n\`\`\`` },
              { value: `Declarado na **linha ${local.line}** da função atual.` },
            ],
          };
        }

        // B. Variáveis globais do arquivo atual
        const global = inScope.globalVars.find((v) => v.name === symbolName);
        if (global) {
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [
              { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n(variável global) ${global.type} ${global.name}\n\`\`\`` },
              { value: `Declarado na **linha ${global.line}** com escopo de arquivo.` },
            ],
          };
        }

        // C. Funções criadas pelo usuário no arquivo atual
        const func = inScope.functions.find((f) => f.name === symbolName);
        if (func) {
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [
              { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n(função) ${func.signature}\n\`\`\`` },
              { value: `Definida na **linha ${func.line}**.` },
            ],
          };
        }

        // D. Structs e Classes do arquivo atual
        const struct = inScope.structs.find((s) => s.name === symbolName);
        if (struct) {
          const membersList = struct.fields.map((f) => `    ${f.type} ${f.name};`).join('\n');
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [
              { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n${isCpp ? 'class' : 'struct'} ${struct.name} {\n${membersList}\n};\n\`\`\`` },
              { value: `Definida na **linha ${struct.line}**.` },
            ],
          };
        }

        // E. Macros (#define) do arquivo atual
        const macro = inScope.macros.find((m) => m.name === symbolName);
        if (macro) {
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [
              { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n#define ${macro.name} ${macro.value || ''}\n\`\`\`` },
              { value: `Definida na **linha ${macro.line}**.` },
            ],
          };
        }

        // F. Símbolos de Headers Próprios Incluídos (#include "meu_header.h" / .hpp)
        for (const header of resolvedIncludes.userHeaders) {
          const hFunc = header.symbols.functions.find((f) => f.name === symbolName);
          if (hFunc) {
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n(função [${header.headerName}]) ${hFunc.signature}\n\`\`\`` },
                { value: `Definida em **${header.headerName}** (linha ${hFunc.line}).` },
              ],
            };
          }

          const hStruct = header.symbols.structs.find((s) => s.name === symbolName);
          if (hStruct) {
            const membersList = hStruct.fields.map((f) => `    ${f.type} ${f.name};`).join('\n');
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\nstruct ${hStruct.name} {\n${membersList}\n};\n\`\`\`` },
                { value: `Definida em **${header.headerName}** (linha ${hStruct.line}).` },
              ],
            };
          }

          const hMacro = header.symbols.macros.find((m) => m.name === symbolName);
          if (hMacro) {
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n#define ${hMacro.name} ${hMacro.value || ''}\n\`\`\`` },
                { value: `Definida em **${header.headerName}** (linha ${hMacro.line}).` },
              ],
            };
          }

          const hVar = header.symbols.variables.find((v) => v.name === symbolName && v.scope === 'global');
          if (hVar) {
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n(variável [${header.headerName}]) ${hVar.type} ${hVar.name}\n\`\`\`` },
                { value: `Declarada em **${header.headerName}** (linha ${hVar.line}).` },
              ],
            };
          }
        }

        // G. Em C++: Símbolos STL (iostream, vector, string, map, algorithm, etc.)
        if (isCpp) {
          const cppStd = CPP_STDLIB_SYMBOLS.find((s) => s.name === symbolName);
          if (cppStd) {
            if (!isHeaderIncluded(cppStd.header, resolvedIncludes.systemHeaders, true)) {
              return {
                range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                contents: [
                  { value: `\`\`\`cpp\n${cppStd.signature || cppStd.name}\n\`\`\`` },
                  { value: `⚠️ **Aviso:** Este símbolo de C++ requer \`#include <${cppStd.header}>\` para ser utilizado no código.` },
                ],
              };
            }

            const contents: Monaco.IMarkdownString[] = [
              { value: `\`\`\`cpp\n${cppStd.signature || cppStd.name}\n\`\`\`` },
              { value: `**Namespace:** \`std\` | **Cabeçalho:** \`<${cppStd.header}>\`\n\n${cppStd.description}` },
            ];
            if (cppStd.parameters && cppStd.parameters.length > 0) {
              const paramsDoc = cppStd.parameters.map((p) => `- \`${p.name}\` (${p.type}): ${p.doc || ''}`).join('\n');
              contents.push({ value: `**Parâmetros:**\n${paramsDoc}` });
            }
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents,
            };
          }
        }

        // H. Símbolos da Biblioteca Padrão C
        const std = C_STDLIB_SYMBOLS.find((s) => s.name === symbolName);
        if (std) {
          if (!isHeaderIncluded(std.header, resolvedIncludes.systemHeaders, isCpp)) {
            const extraNote = isCpp && C_TO_CPP_HEADER_MAP[std.header || ''] ? ` (ou \`<${C_TO_CPP_HEADER_MAP[std.header || '']}>\`)` : '';
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n${std.signature || std.name}\n\`\`\`` },
                { value: `⚠️ **Aviso:** Esta função requer \`#include <${std.header}>\`${extraNote} para ser utilizada no código.` },
              ],
            };
          }

          const contents: Monaco.IMarkdownString[] = [
            { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n${std.signature || std.name}\n\`\`\`` },
            { value: `**Cabeçalho:** \`<${std.header}>\`\n\n${std.description}` },
          ];
          if (std.parameters && std.parameters.length > 0) {
            const paramsDoc = std.parameters.map((p) => `- \`${p.name}\` (${p.type}): ${p.doc || ''}`).join('\n');
            contents.push({ value: `**Parâmetros:**\n${paramsDoc}` });
          }
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents,
          };
        }

        // I. Palavras-chave da Linguagem
        if (isCpp) {
          const cppKw = CPP_KEYWORDS.find((k) => k.name === symbolName);
          if (cppKw) {
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `\`\`\`cpp\n(palavra-chave C++) ${cppKw.name}\n\`\`\`` },
                { value: cppKw.description },
              ],
            };
          }
        }

        const kw = C_KEYWORDS.find((k) => k.name === symbolName);
        if (kw) {
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [
              { value: `\`\`\`${isCpp ? 'cpp' : 'c'}\n(palavra-chave) ${kw.name}\n\`\`\`` },
              { value: kw.description },
            ],
          };
        }

        return null;
      },
    });
  }

  // 4. Provedor de Dica de Parâmetros (Signature Help ao digitar '(' e ',')
  for (const lang of supportedLanguages) {
    monaco.languages.registerSignatureHelpProvider(lang, {
      signatureHelpTriggerCharacters: ['(', ','],
      signatureHelpRetriggerCharacters: [','],
      provideSignatureHelp: (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);

        const callInfo = parseActiveCall(textBeforeCursor);
        if (!callInfo) return null;

        const { functionName, activeParameter } = callInfo;
        const isCpp = isCppMode(model);
        const sourceCode = model.getValue();
        const symbols = getCachedCSymbols(model);
        const resolvedIncludes = resolveIncludedSymbols(sourceCode, (name) => getHeaderContent(name, monaco));

        // 1. Procura entre as funções do próprio arquivo
        const customFunc = symbols.functions.find((f) => f.name === functionName);
        if (customFunc) {
          const params = customFunc.parameters.map((p) => ({
            label: `${p.type} ${p.name}`,
            documentation: `Parâmetro de ${customFunc.name}`,
          }));

          return {
            value: {
              signatures: [
                {
                  label: customFunc.signature,
                  documentation: `Função declarada na linha ${customFunc.line}`,
                  parameters: params,
                },
              ],
              activeSignature: 0,
              activeParameter: Math.min(activeParameter, Math.max(0, params.length - 1)),
            },
            dispose: () => {},
          };
        }

        // 2. Procura entre as funções de headers do usuário incluídos
        for (const header of resolvedIncludes.userHeaders) {
          const hFunc = header.symbols.functions.find((f) => f.name === functionName);
          if (hFunc) {
            const params = hFunc.parameters.map((p) => ({
              label: `${p.type} ${p.name}`,
              documentation: `Parâmetro de ${hFunc.name} (${header.headerName})`,
            }));

            return {
              value: {
                signatures: [
                  {
                    label: hFunc.signature,
                    documentation: `Função declarada em ${header.headerName} (linha ${hFunc.line})`,
                    parameters: params,
                  },
                ],
                activeSignature: 0,
                activeParameter: Math.min(activeParameter, Math.max(0, params.length - 1)),
              },
              dispose: () => {},
            };
          }
        }

        // 3. Em C++: Procura na STL (apenas se a biblioteca estiver incluída!)
        if (isCpp) {
          const cppFunc = CPP_STDLIB_SYMBOLS.find(
            (s) => s.name === functionName && s.kind === 'function'
          );
          if (cppFunc && cppFunc.signature) {
            if (!isHeaderIncluded(cppFunc.header, resolvedIncludes.systemHeaders, true)) {
              return null;
            }

            const params = (cppFunc.parameters || []).map((p) => ({
              label: `${p.type} ${p.name}`,
              documentation: p.doc || '',
            }));

            return {
              value: {
                signatures: [
                  {
                    label: cppFunc.signature,
                    documentation: `${cppFunc.description}\n\nRequer: <${cppFunc.header}>`,
                    parameters: params,
                  },
                ],
                activeSignature: 0,
                activeParameter: Math.min(activeParameter, Math.max(0, params.length - 1)),
              },
              dispose: () => {},
            };
          }
        }

        // 4. Procura na biblioteca padrão C (apenas se a biblioteca estiver incluída!)
        const stdFunc = C_STDLIB_SYMBOLS.find(
          (s) => s.name === functionName && s.kind === 'function'
        );
        if (stdFunc && stdFunc.signature) {
          if (!isHeaderIncluded(stdFunc.header, resolvedIncludes.systemHeaders, isCpp)) {
            return null;
          }

          const params = (stdFunc.parameters || []).map((p) => ({
            label: `${p.type} ${p.name}`,
            documentation: p.doc || '',
          }));

          return {
            value: {
              signatures: [
                {
                  label: stdFunc.signature,
                  documentation: `${stdFunc.description}\n\nRequer: <${stdFunc.header}>`,
                  parameters: params,
                },
              ],
              activeSignature: 0,
              activeParameter: Math.min(activeParameter, Math.max(0, params.length - 1)),
            },
            dispose: () => {},
          };
        }

        return null;
      },
    });
  }
}

/**
 * Analisa a linha de texto para identificar o nome da função atual e o índice do parâmetro ativo
 */
function parseActiveCall(text: string): { functionName: string; activeParameter: number } | null {
  let depth = 0;
  let commas = 0;
  let openParenIndex = -1;

  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === ')') {
      depth++;
    } else if (ch === '(') {
      if (depth === 0) {
        openParenIndex = i;
        break;
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      commas++;
    }
  }

  if (openParenIndex <= 0) return null;

  const beforeParen = text.substring(0, openParenIndex).trim();
  // Remove argumentos de template como <int> ou <std::string>
  const cleanBeforeParen = beforeParen.replace(/<[^>]*>$/, '').trim();
  const match = cleanBeforeParen.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
  if (!match) return null;

  return {
    functionName: match[1],
    activeParameter: commas,
  };
}
