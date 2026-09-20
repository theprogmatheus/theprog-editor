import { CPP_CONTAINER_METHODS } from './cppStdLibCatalog';

export interface CSymbolVariable {
  name: string;
  type: string;
  line: number;
  scope: 'local' | 'param' | 'global';
  structType?: string;
  isArray?: boolean;
  isPointer?: boolean;
}

export interface CSymbolFunction {
  name: string;
  returnType: string;
  signature: string;
  line: number;
  startLine: number;
  endLine: number;
  parameters: { name: string; type: string }[];
}

export interface CSymbolStructField {
  name: string;
  type: string;
}

export interface CSymbolStruct {
  name: string;
  fields: CSymbolStructField[];
  line: number;
  startLine: number;
  endLine: number;
}

export interface CSymbolMacro {
  name: string;
  value?: string;
  line: number;
}

export interface CFileSymbols {
  variables: CSymbolVariable[];
  functions: CSymbolFunction[];
  structs: CSymbolStruct[];
  macros: CSymbolMacro[];
}

export interface CIncludeDirective {
  type: 'system' | 'user';
  header: string;
  line: number;
}

export interface CIncludedHeaderResult {
  headerName: string;
  symbols: CFileSymbols;
}

export interface CResolvedIncludes {
  systemHeaders: Set<string>;
  userHeaders: CIncludedHeaderResult[];
}

/**
 * Remove comentários de bloco e de linha preservando o número exato de quebras de linha.
 * Isso garante que o número da linha (1-indexed) corresponda com perfeição ao editor Monaco.
 */
export function stripCommentsKeepLines(code: string): string {
  let result = '';
  let inLineComment = false;
  let inBlockComment = false;
  let inString = false;
  let inChar = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        result += '\n';
      } else {
        result += ' ';
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        result += '  ';
        i++;
      } else if (ch === '\n') {
        result += '\n';
      } else {
        result += ' ';
      }
      continue;
    }

    if (inString) {
      result += ch;
      if (ch === '\\' && next) {
        result += next;
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (inChar) {
      result += ch;
      if (ch === '\\' && next) {
        result += next;
        i++;
      } else if (ch === "'") {
        inChar = false;
      }
      continue;
    }

    // Abertura de comentários ou literais
    if (ch === '/' && next === '/') {
      inLineComment = true;
      result += '  ';
      i++;
    } else if (ch === '/' && next === '*') {
      inBlockComment = true;
      result += '  ';
      i++;
    } else if (ch === '"') {
      inString = true;
      result += ch;
    } else if (ch === "'") {
      inChar = true;
      result += ch;
    } else {
      result += ch;
    }
  }

  return result;
}

/**
 * Analisa o código fonte em C e extrai símbolos: variáveis, funções, structs e macros.
 */
export function analyzeCSymbols(sourceCode: string): CFileSymbols {
  const cleanCode = stripCommentsKeepLines(sourceCode);
  const lines = cleanCode.split('\n');

  const macros: CSymbolMacro[] = [];
  const structs: CSymbolStruct[] = [];
  const functions: CSymbolFunction[] = [];
  const variables: CSymbolVariable[] = [];

  // 1. Extração de Macros (#define)
  const macroRegex = /^\s*#\s*define\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(.*))?$/;
  lines.forEach((lineText, idx) => {
    const match = lineText.match(macroRegex);
    if (match) {
      macros.push({
        name: match[1],
        value: match[2]?.trim(),
        line: idx + 1,
      });
    }
  });

  // 2. Extração de Structs e Typedefs de Struct
  // Formato: typedef struct [Opcional] { ... } Nome; ou struct Nome { ... };
  const structRegex = /(?:typedef\s+)?struct\s*([A-Za-z_][A-Za-z0-9_]*)?\s*\{([^}]*)\}\s*([A-Za-z_][A-Za-z0-9_]*)?;/g;
  let structMatch: RegExpExecArray | null;
  while ((structMatch = structRegex.exec(cleanCode)) !== null) {
    const structTag = structMatch[1];
    const body = structMatch[2];
    const typedefName = structMatch[3];
    const name = typedefName || structTag;

    if (name) {
      const matchPos = structMatch.index;
      const lineNum = cleanCode.substring(0, matchPos).split('\n').length;
      const fields: CSymbolStructField[] = [];

      const fieldLines = body.split(';');
      for (const rawField of fieldLines) {
        const trimmed = rawField.trim();
        if (!trimmed) continue;
        const fieldMatch = trimmed.match(/^(?:const\s+)?([A-Za-z_][A-Za-z0-9_*\s]+)\s+([A-Za-z_][A-Za-z0-9_]*)(\s*\[.*\])?$/);
        if (fieldMatch) {
          const fType = (fieldMatch[1] + (fieldMatch[3] ? '[]' : '')).trim();
          fields.push({
            name: fieldMatch[2],
            type: fType,
          });
        }
      }

      const endLine = cleanCode.substring(0, matchPos + structMatch[0].length).split('\n').length;

      structs.push({
        name,
        fields,
        line: lineNum,
        startLine: lineNum,
        endLine,
      });
    }
  }

  // 2.b Extração de Classes C++
  const classRegex = /class\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*(?:public|protected|private)\s+[A-Za-z_][A-Za-z0-9_:]*)?\s*\{([^}]*)\}\s*;/g;
  let classMatch: RegExpExecArray | null;
  while ((classMatch = classRegex.exec(cleanCode)) !== null) {
    const name = classMatch[1];
    const body = classMatch[2];
    const matchPos = classMatch.index;
    const lineNum = cleanCode.substring(0, matchPos).split('\n').length;
    const endLine = cleanCode.substring(0, matchPos + classMatch[0].length).split('\n').length;
    const fields: CSymbolStructField[] = [];

    const fieldLines = body.split(';');
    for (const rawField of fieldLines) {
      const trimmed = rawField.trim();
      if (!trimmed || trimmed.startsWith('private:') || trimmed.startsWith('protected:')) continue;
      const cleanField = trimmed.replace(/^public:\s*/, '').trim();
      const fieldMatch = cleanField.match(/^(?:(?:virtual|static|inline|explicit)\s+)*(?:const\s+)?([A-Za-z_][A-Za-z0-9_*\s<>&:]+)\s+([A-Za-z_][A-Za-z0-9_]*)(\(.*\)|\[.*\])?/);
      if (fieldMatch) {
        fields.push({
          name: fieldMatch[2] + (fieldMatch[3]?.startsWith('(') ? '()' : ''),
          type: fieldMatch[1].trim(),
        });
      }
    }

    structs.push({
      name,
      fields,
      line: lineNum,
      startLine: lineNum,
      endLine,
    });
  }

  // 3. Extração de Funções e identificação de blocos { ... }
  // Regex para assinatura de função: retorno + nome + (parametros) + { ou ; (protótipo)
  const funcRegex = /(?:(?:static|inline|extern|virtual)\s+)*(?:const\s+)?([A-Za-z_][A-Za-z0-9_*\s<>&:]+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:const\s*)?(?:override\s*)?([{;])/g;
  let funcMatch: RegExpExecArray | null;

  while ((funcMatch = funcRegex.exec(cleanCode)) !== null) {
    const returnType = funcMatch[1].trim();
    const funcName = funcMatch[2].trim();
    const rawParams = funcMatch[3].trim();
    const terminator = funcMatch[4];
    const matchIndex = funcMatch.index;

    // Evita falsos positivos com palavras-chave de controle de fluxo como if, for, while, switch
    if (['if', 'for', 'while', 'switch', 'return', 'catch', 'typedef', 'sizeof'].includes(funcName)) {
      continue;
    }

    const startLine = cleanCode.substring(0, matchIndex).split('\n').length;
    let endLine = startLine;

    // Se for definição com corpo {, encontra o fechamento } correspondente
    if (terminator === '{') {
      const braceIndex = cleanCode.indexOf('{', matchIndex);
      let depth = 1;
      let endPos = braceIndex + 1;
      while (endPos < cleanCode.length && depth > 0) {
        if (cleanCode[endPos] === '{') depth++;
        else if (cleanCode[endPos] === '}') depth--;
        endPos++;
      }
      endLine = cleanCode.substring(0, endPos).split('\n').length;
    }

    // Processa parâmetros da função
    const parameters: { name: string; type: string }[] = [];
    if (rawParams && rawParams !== 'void') {
      const paramParts = rawParams.split(',');
      for (const p of paramParts) {
        const pTrimmed = p.trim();
        const pMatch = pTrimmed.match(/(?:const\s+)?([A-Za-z_][A-Za-z0-9_*\s<>&:]+?)\s+([A-Za-z_][A-Za-z0-9_]*)(\s*\[.*\])?$/);
        if (pMatch) {
          const paramType = (pMatch[1] + (pMatch[3] ? '[]' : '')).trim();
          const paramName = pMatch[2].trim();
          parameters.push({ name: paramName, type: paramType });

          if (terminator === '{') {
            variables.push({
              name: paramName,
              type: paramType,
              line: startLine,
              scope: 'param',
              structType: extractStructType(paramType, structs),
              isPointer: paramType.includes('*'),
              isArray: paramType.includes('['),
            });
          }
        }
      }
    }

    const paramSignature = parameters.map((p) => `${p.type} ${p.name}`).join(', ');
    const signature = `${returnType} ${funcName}(${paramSignature || (rawParams === 'void' ? 'void' : '')})`;

    const existingIndex = functions.findIndex((f) => f.name === funcName);
    if (existingIndex >= 0) {
      if (terminator === '{') {
        functions[existingIndex].startLine = startLine;
        functions[existingIndex].endLine = endLine;
        functions[existingIndex].signature = signature;
      }
    } else {
      functions.push({
        name: funcName,
        returnType,
        signature,
        line: startLine,
        startLine,
        endLine,
        parameters,
      });
    }
  }

  // 4. Extração de Variáveis (Locais e Globais)
  // Tipos C e C++ conhecidos e apelidos comuns
  const baseTypes = [
    'int', 'char', 'float', 'double', 'void', 'short', 'long', 'unsigned', 'signed',
    'size_t', 'bool', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
    'int8_t', 'int16_t', 'int32_t', 'int64_t', 'time_t', 'clock_t', 'FILE',
    'auto', 'string', 'vector', 'map', 'set', 'unordered_map', 'unordered_set',
    'unique_ptr', 'shared_ptr', 'pair', 'ifstream', 'ofstream', 'stringstream',
  ];
  const customTypes = structs.map((s) => s.name);
  const allKnownTypes = [...baseTypes, ...customTypes];
  const typePattern = `(?:const\\s+|static\\s+|extern\\s+|unsigned\\s+|signed\\s+|long\\s+|short\\s+)*(?:struct\\s+|class\\s+)?(?:${allKnownTypes.join('|')}|(?:std::)?[A-Za-z_][A-Za-z0-9_]*_t|(?:std::)?[A-Za-z_][A-Za-z0-9_]*(?:<[^>]+>)?|[A-Z][A-Za-z0-9_]*)`;

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;

    // Ignora se estiver dentro do corpo de uma struct (são campos da struct, já extraídos)
    const insideStruct = structs.some((s) => lineNum >= s.startLine && lineNum <= s.endLine);
    if (insideStruct) return;

    // Procura declarações na linha: Tipo var1, var2 = expr;
    const lineDeclRegex = new RegExp(`(?:^|[;{}\\n])\\s*(${typePattern})\\s+([^;]+);`, 'g');
    let lineMatch: RegExpExecArray | null;

    while ((lineMatch = lineDeclRegex.exec(lineText)) !== null) {
      const rawType = lineMatch[1].trim();
      const declList = lineMatch[2].trim();

      if (['return', 'typedef', 'struct', 'goto', 'case'].includes(rawType)) continue;

      // Determina se é local a alguma função ou global
      const enclosingFunc = functions.find((f) => lineNum >= f.startLine && lineNum <= f.endLine);
      const scope: 'local' | 'global' = enclosingFunc ? 'local' : 'global';

      // Quebra declarações múltiplas, ex: int a, b = 10, *c, arr[20];
      const items = splitVarDeclarations(declList);
      for (const item of items) {
        if (!item.name || ['return', 'break', 'continue'].includes(item.name)) continue;

        let fullType = rawType;
        if (item.isPointer) fullType += ' *';
        if (item.isArray) fullType += '[]';

        // Evita duplicatas com parâmetros na mesma linha
        const alreadyExists = variables.some(
          (v) => v.name === item.name && Math.abs(v.line - lineNum) <= 1
        );
        if (!alreadyExists) {
          variables.push({
            name: item.name,
            type: fullType,
            line: lineNum,
            scope,
            structType: extractStructType(rawType, structs),
            isPointer: item.isPointer || rawType.includes('*'),
            isArray: item.isArray,
          });
        }
      }
    }
  });

  // 5. Extração de variáveis em cabeçalhos de loops for (ex: for (int i = 0; ...))
  const forLoopRegex = /for\s*\(\s*(?:int|size_t|unsigned|char|long)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
  let forMatch: RegExpExecArray | null;
  while ((forMatch = forLoopRegex.exec(cleanCode)) !== null) {
    const varName = forMatch[1];
    const matchPos = forMatch.index;
    const lineNum = cleanCode.substring(0, matchPos).split('\n').length;

    const alreadyExists = variables.some((v) => v.name === varName && v.line === lineNum);
    if (!alreadyExists) {
      variables.push({
        name: varName,
        type: 'int',
        line: lineNum,
        scope: 'local',
      });
    }
  }

  // 5.b Extração de variáveis em range-based for C++ (ex: for (const auto &item : lista))
  const forRangeRegex = /for\s*\(\s*(?:const\s+)?(?:auto|[A-Za-z_][A-Za-z0-9_:]*(?:<[^>]+>)?)\s*&?\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = forRangeRegex.exec(cleanCode)) !== null) {
    const varName = rangeMatch[1];
    const matchPos = rangeMatch.index;
    const lineNum = cleanCode.substring(0, matchPos).split('\n').length;
    const alreadyExists = variables.some((v) => v.name === varName && v.line === lineNum);
    if (!alreadyExists) {
      variables.push({
        name: varName,
        type: 'auto',
        line: lineNum,
        scope: 'local',
      });
    }
  }

  return {
    variables,
    functions,
    structs,
    macros,
  };
}

/**
 * Extrai o nome da struct caso o tipo corresponda a uma struct cadastrada.
 */
function extractStructType(typeName: string, structs: CSymbolStruct[]): string | undefined {
  const clean = typeName.replace(/^struct\s+/, '').replace(/[*[\]\s]/g, '');
  const found = structs.find((s) => s.name === clean);
  return found ? found.name : undefined;
}

interface ParsedVarItem {
  name: string;
  isPointer: boolean;
  isArray: boolean;
}

function splitVarDeclarations(declList: string): ParsedVarItem[] {
  const results: ParsedVarItem[] = [];
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < declList.length; i++) {
    const ch = declList[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
    else if (ch === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);

  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    // Se for protótipo de função (sem '=' e contendo '('), ignora
    const withoutInit = trimmed.split('=')[0].trim();
    if (withoutInit.includes('(')) continue;

    const isPointer = withoutInit.includes('*');
    const isArray = withoutInit.includes('[');
    const varNameMatch = withoutInit.match(/([A-Za-z_][A-Za-z0-9_]*)(?:\s*\[.*\])?$/);

    if (varNameMatch) {
      const varName = varNameMatch[1];
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(varName) && !['return', 'break', 'continue'].includes(varName)) {
        results.push({
          name: varName,
          isPointer,
          isArray,
        });
      }
    }
  }

  return results;
}

/**
 * Retorna todos os símbolos válidos no escopo do cursor na linha indicada.
 */
export function getSymbolsInScope(
  symbols: CFileSymbols,
  currentLine: number
): {
  localVars: CSymbolVariable[];
  globalVars: CSymbolVariable[];
  functions: CSymbolFunction[];
  macros: CSymbolMacro[];
  structs: CSymbolStruct[];
} {
  // Identifica se o cursor está dentro do corpo de alguma função
  const activeFunction = symbols.functions.find(
    (f) => currentLine >= f.startLine && currentLine <= f.endLine
  );

  let localVars: CSymbolVariable[] = [];

  if (activeFunction) {
    // Parâmetros da função atual
    const paramVars = symbols.variables.filter(
      (v) => v.scope === 'param' && v.line === activeFunction.startLine
    );

    // Variáveis locais declaradas dentro da função até a linha atual do cursor
    const scopedLocals = symbols.variables.filter(
      (v) =>
        v.scope === 'local' &&
        v.line >= activeFunction.startLine &&
        v.line <= currentLine
    );

    localVars = [...paramVars, ...scopedLocals];
  }

  const globalVars = symbols.variables.filter((v) => v.scope === 'global');

  return {
    localVars,
    globalVars,
    functions: symbols.functions,
    macros: symbols.macros,
    structs: symbols.structs,
  };
}

/**
 * Tenta resolver os membros de uma struct quando o usuário digita após '.' ou '->'
 */
export function resolveStructMembers(
  varName: string,
  symbols: CFileSymbols,
  currentLine: number,
  extraStructs: CSymbolStruct[] = [],
  extraVars: CSymbolVariable[] = []
): CSymbolStructField[] | null {
  const inScope = getSymbolsInScope(symbols, currentLine);
  const allVars = [...inScope.localVars, ...inScope.globalVars, ...extraVars];

  const variable = allVars.find((v) => v.name === varName);
  if (!variable) return null;

  const rawType = variable.type.toLowerCase();

  // Métodos de contêineres STL C++
  if (rawType.includes('vector')) {
    return CPP_CONTAINER_METHODS.vector;
  }
  if (rawType.includes('string') && !rawType.includes('cstring')) {
    return CPP_CONTAINER_METHODS.string;
  }
  if (rawType.includes('unordered_map')) {
    return CPP_CONTAINER_METHODS.unordered_map;
  }
  if (rawType.includes('unordered_set')) {
    return CPP_CONTAINER_METHODS.unordered_set;
  }
  if (rawType.includes('map')) {
    return CPP_CONTAINER_METHODS.map;
  }
  if (rawType.includes('set')) {
    return CPP_CONTAINER_METHODS.set;
  }
  if (rawType.includes('queue')) {
    return CPP_CONTAINER_METHODS.queue;
  }
  if (rawType.includes('stack')) {
    return CPP_CONTAINER_METHODS.stack;
  }
  if (rawType.includes('deque')) {
    return CPP_CONTAINER_METHODS.deque;
  }
  if (rawType.includes('array')) {
    return CPP_CONTAINER_METHODS.array;
  }
  if (rawType.includes('stringstream')) {
    return CPP_CONTAINER_METHODS.stringstream;
  }

  const structName = variable.structType || variable.type.replace(/^(?:struct|class)\s+/, '').replace(/[*[\]\s]/g, '');
  const allStructs = [...symbols.structs, ...extraStructs];
  const structDef = allStructs.find((s) => s.name === structName);

  if (structDef) {
    return structDef.fields;
  }

  return null;
}

/**
 * Extrai todas as diretivas #include presentes no código (sistema e usuário).
 * Ignora linhas comentadas.
 */
export function extractIncludes(sourceCode: string): CIncludeDirective[] {
  const cleanCode = stripCommentsKeepLines(sourceCode);
  const lines = cleanCode.split('\n');
  const includes: CIncludeDirective[] = [];

  const includeRegex = /^\s*#\s*include\s*(?:<([^>]+)>|"([^"]+)")/;

  lines.forEach((lineText, idx) => {
    const match = lineText.match(includeRegex);
    if (match) {
      const line = idx + 1;
      if (match[1]) {
        includes.push({
          type: 'system',
          header: match[1].trim(),
          line,
        });
      } else if (match[2]) {
        includes.push({
          type: 'user',
          header: match[2].trim(),
          line,
        });
      }
    }
  });

  return includes;
}

/**
 * Resolve e carrega os cabeçalhos incluídos no código (tanto bibliotecas padrão quanto arquivos do usuário).
 * Suporta inclusões recursivas com proteção contra dependências circulares.
 */
export function resolveIncludedSymbols(
  sourceCode: string,
  fileResolver?: (filename: string) => string | undefined
): CResolvedIncludes {
  const systemHeaders = new Set<string>();
  const userHeaders: CIncludedHeaderResult[] = [];
  const visitedUserHeaders = new Set<string>();

  function processCode(code: string) {
    const directives = extractIncludes(code);

    for (const d of directives) {
      if (d.type === 'system') {
        systemHeaders.add(d.header);
      } else if (d.type === 'user') {
        const cleanName = d.header.replace(/^\.\//, '').trim();

        // Se for um cabeçalho padrão incluído com aspas (ex: "stdio.h"), adiciona também como system
        if (cleanName.endsWith('.h')) {
          systemHeaders.add(cleanName);
        }

        if (visitedUserHeaders.has(cleanName)) continue;
        visitedUserHeaders.add(cleanName);

        if (fileResolver) {
          const content = fileResolver(cleanName);
          if (content !== undefined && content !== null) {
            const headerSymbols = analyzeCSymbols(content);
            userHeaders.push({
              headerName: cleanName,
              symbols: headerSymbols,
            });

            // Resolução recursiva de cabeçalhos que esse header inclui
            processCode(content);
          }
        }
      }
    }
  }

  processCode(sourceCode);

  return {
    systemHeaders,
    userHeaders,
  };
}
