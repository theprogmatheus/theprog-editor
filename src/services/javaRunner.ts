export interface JavaExecutionCallbacks {
  onOutput: (text: string) => void;
  onControllerReady?: (controller: { abort: () => void }) => void;
}

export async function executeJavaCode(
  filename: string,
  rawCode: string,
  callbacks: JavaExecutionCallbacks
): Promise<number> {
  const { onOutput, onControllerReady } = callbacks;

  let aborted = false;
  if (onControllerReady) {
    onControllerReady({
      abort: () => {
        aborted = true;
        onOutput('\r\n\x1b[31m[Execução Java interrompida]\x1b[0m\r\n');
      },
    });
  }

  // 1. Detecta o nome da classe
  const classMatch = rawCode.match(/(?:public\s+)?class\s+([A-Za-z0-9_]+)/);
  const className = classMatch ? classMatch[1] : filename.replace(/\.java$/, '');

  // 2. Validação de método main
  if (!rawCode.includes('public static void main') && !rawCode.includes('static public void main')) {
    onOutput(`\x1b[31mError: Main method not found in class ${className}, please define the main method as:\r\n   public static void main(String[] args)\x1b[0m\r\n`);
    return 1;
  }

  // 3. Validação de parênteses e chaves básicas
  const openBraces = (rawCode.match(/\{/g) || []).length;
  const closeBraces = (rawCode.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    onOutput(`\x1b[31m${filename}: error: reached end of file while parsing (unmatched braces)\x1b[0m\r\n`);
    return 1;
  }

  // 4. Execução em sandbox convertendo constructs canônicos de Java para runtime JS
  try {
    // Extrai o corpo do método main
    const mainBodyMatch = rawCode.match(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}\s*\}\s*$/);
    let runnableCode = '';

    if (mainBodyMatch) {
      runnableCode = mainBodyMatch[1];
    } else {
      // Fallback: extrai bloco de main genericamente
      const idx = rawCode.indexOf('main(');
      if (idx !== -1) {
        const start = rawCode.indexOf('{', idx);
        runnableCode = rawCode.slice(start + 1, rawCode.lastIndexOf('}'));
      } else {
        runnableCode = rawCode;
      }
    }

    // Transpilação de conveniência de Java para JS canônico
    let jsCode = runnableCode
      // System.out.println e print
      .replace(/System\.out\.println\s*\(/g, '__theprog_java_println(')
      .replace(/System\.out\.print\s*\(/g, '__theprog_java_print(')
      .replace(/System\.err\.println\s*\(/g, '__theprog_java_err(')
      // Tipos primitivos em declarações (ex: int a = 5; -> let a = 5;)
      .replace(/\b(?:int|long|double|float|boolean|char|String|byte|short|var)\s+([A-Za-z0-9_]+)\s*(=|;|,)/g, 'let $1 $2')
      .replace(/\b(?:int|long|double|float|boolean|char|String|byte|short)\s*\[\s*\]\s*([A-Za-z0-9_]+)\s*(=|;|,)/g, 'let $1 $2')
      .replace(/new\s+(?:int|long|double|float|boolean|char|String|byte|short)\[\s*(\d+)\s*\]/g, 'new Array($1).fill(0)')
      .replace(/\.length\(\)/g, '.length')
      .replace(/\.equals\(/g, '=== (')
      .replace(/\.equalsIgnoreCase\(([^)]+)\)/g, '.toLowerCase() === $1.toLowerCase()');

    const customPrint = (val: any) => {
      if (aborted) return;
      const text = val !== undefined ? String(val) : 'null';
      onOutput(text);
    };
    const customPrintln = (val: any = '') => {
      if (aborted) return;
      const text = val !== undefined ? String(val) : '';
      onOutput(text + '\r\n');
    };
    const customErr = (val: any = '') => {
      if (aborted) return;
      onOutput(`\x1b[31m${val}\x1b[0m\r\n`);
    };

    const sandbox = new Function(
      '__theprog_java_print',
      '__theprog_java_println',
      '__theprog_java_err',
      'Math',
      `"use strict";
       try {
         ${jsCode}
       } catch (e) {
         __theprog_java_err("Exception in thread \\"main\\" " + (e.stack || e));
         throw e;
       }`
    );

    sandbox(customPrint, customPrintln, customErr, Math);
    return 0;
  } catch (err: any) {
    if (aborted) return 130;
    const msg = err?.message || String(err);
    onOutput(`\x1b[31m${filename}: Erro em tempo de execução: ${msg}\x1b[0m\r\n`);
    return 1;
  }
}
