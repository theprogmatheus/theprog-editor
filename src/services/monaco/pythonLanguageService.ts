import type * as Monaco from 'monaco-editor';
import { PYTHON_KEYWORDS, PYTHON_SNIPPETS } from './pythonSnippets';

let isRegistered = false;

/**
 * Registra snippets didáticos e palavras-chave para Python no Monaco Editor.
 * A sintaxe (tokenização) já é nativa do Monaco; aqui adicionamos produtividade.
 */
export function registerPythonLanguageService(monaco: typeof Monaco): void {
  if (isRegistered) return;
  isRegistered = true;

  monaco.languages.setLanguageConfiguration('python', {
    comments: {
      lineComment: '#',
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
      { open: "'", close: "'", notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern:
        /^\s*(class|def|if|elif|else|for|while|try|except|finally|with|match|case)\b.*:\s*(#.*)?$/,
      decreaseIndentPattern: /^\s*(elif|else|except|finally|case)\b/,
    },
  });

  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = PYTHON_SNIPPETS.map((snippet) => ({
        label: snippet.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        documentation: snippet.description,
        insertText: snippet.body,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
      }));

      for (const keyword of PYTHON_KEYWORDS) {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
        });
      }

      return { suggestions };
    },
  });
}
