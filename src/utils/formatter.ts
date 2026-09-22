import initAsync, { format as clangFormat } from '@wasm-fmt/clang-format/vite';
import { runtimeManager } from '../services/runtimes/manager';

let clangInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Formata código com a ferramenta nativa de cada linguagem:
 * - C/C++: Clang-Format (WebAssembly)
 * - Python: black (executado no runtime Pyodide)
 * - Demais: indentação inteligente (fallback)
 */
export async function formatCode(code: string, filename: string = 'main.c'): Promise<string> {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.py')) {
    try {
      const formatted = await runtimeManager.formatPython(code);
      if (formatted !== null && formatted !== undefined) {
        return formatted;
      }
    } catch (err) {
      console.warn('black indisponível, mantendo código original:', err);
    }
    return code;
  }

  // Formatos nativamente suportados pelo Clang-Format (C e C++)
  const isSupportedByClang =
    lower.endsWith('.c') ||
    lower.endsWith('.cpp') ||
    lower.endsWith('.cc') ||
    lower.endsWith('.cxx') ||
    lower.endsWith('.h') ||
    lower.endsWith('.hpp');

  if (isSupportedByClang) {
    try {
      if (!clangInitialized) {
        if (!initPromise) {
          initPromise = initAsync();
        }
        await initPromise;
        clangInitialized = true;
      }

      // Estilo profissional baseado em Google/LLVM com 4 espaços
      const style = '{BasedOnStyle: Google, IndentWidth: 4, TabWidth: 4, UseTab: Never, ColumnLimit: 120}';
      return clangFormat(code, filename, style);
    } catch (err) {
      console.warn('clang-format error, fallback to autoIndentCode:', err);
    }
  }

  // Fallback para arquivos de texto genéricos
  return autoIndentCode(code, 4);
}

/**
 * Formatador de código por indentação inteligente (fallback para Monaco)
 */
export function autoIndentCode(code: string, indentSize: number = 4): string {
  const lines = code.split('\n');
  const indentStr = ' '.repeat(indentSize);
  let depth = 0;
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      result.push('');
      continue;
    }

    // Se a linha começa com chave de fechamento ou case/default, desindenta esta linha
    let lineIndentAdjustment = 0;
    if (line.startsWith('}') || line.startsWith(')')) {
      lineIndentAdjustment = -1;
    } else if (line.startsWith('case ') || line.startsWith('default:')) {
      lineIndentAdjustment = -1;
    }

    const currentDepth = Math.max(0, depth + lineIndentAdjustment);
    result.push(indentStr.repeat(currentDepth) + line);

    // Calcula balanço de chaves ignorando strings literais
    let openCount = 0;
    let closeCount = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if ((ch === '"' || ch === "'") && (j === 0 || line[j - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        } else if (quoteChar === ch) {
          inQuotes = false;
        }
      }
      if (!inQuotes) {
        if (ch === '{') openCount++;
        if (ch === '}') closeCount++;
      }
    }

    depth = Math.max(0, depth + openCount - closeCount);
  }

  return result.join('\n');
}

