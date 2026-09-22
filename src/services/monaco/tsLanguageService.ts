import type * as Monaco from 'monaco-editor';
import type { FileItem } from '../../types/editor';

let isRegistered = false;
const syncedLibs = new Map<string, string>();

/**
 * Configura o serviço TypeScript/JavaScript nativo do Monaco:
 * - Diagnósticos de tipo habilitados para TypeScript
 * - JavaScript com validação apenas de sintaxe (didático)
 * - Opções de compilação alinhadas com o esbuild (ES2020, ESNext, DOM)
 */
export function setupTsLanguageService(monaco: typeof Monaco): void {
  if (isRegistered) return;
  isRegistered = true;

  const ts = monaco.typescript;

  // Atenção: setCompilerOptions SUBSTITUI os defaults do Monaco.
  // allowNonTsExtensions é obrigatório (sem ele o lib.dom.d.ts não resolve e
  // "console" deixa de existir); não definir "lib" para usar o default
  // lib.es<target>.full.d.ts, que já inclui DOM e DOM.Iterable.
  const compilerOptions: Monaco.typescript.CompilerOptions = {
    allowNonTsExtensions: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    allowJs: true,
    checkJs: false,
    strict: false,
    noImplicitAny: false,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.React,
  };

  ts.typescriptDefaults.setCompilerOptions(compilerOptions);
  ts.javascriptDefaults.setCompilerOptions(compilerOptions);

  ts.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  ts.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
}

/**
 * Disponibiliza os arquivos do workspace para o serviço TypeScript,
 * permitindo que imports entre arquivos resolvam no IntelliSense.
 */
export function syncWorkspaceTsFiles(monaco: typeof Monaco, files: FileItem[]): void {
  const ts = monaco.typescript;

  for (const file of files) {
    if (file.isFolder || typeof file.content !== 'string') continue;
    if (!/\.(ts|js|mjs|cjs)$/.test(file.name)) continue;

    const uri = `file://${file.path.startsWith('/') ? file.path : `/${file.path}`}`;
    if (syncedLibs.get(uri) === file.content) continue;
    syncedLibs.set(uri, file.content);

    ts.typescriptDefaults.addExtraLib(file.content, uri);
    ts.javascriptDefaults.addExtraLib(file.content, uri);
  }
}
