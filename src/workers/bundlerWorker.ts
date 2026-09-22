import * as esbuild from 'esbuild-wasm';

const BASE_URL = import.meta.env.BASE_URL;
const WASM_URL = `${BASE_URL}runtimes/esbuild/esbuild.wasm`;
const WASM_FALLBACK_BYTES = 14_000_000;

let initPromise: Promise<void> | null = null;

function post(message: unknown): void {
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(message);
}

function normalizePath(path: string): string {
  const parts = path.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function resolveWorkspaceModule(
  specifier: string,
  importer: string,
  files: Map<string, string>
): string | null {
  const baseDir = importer.includes('/') ? importer.slice(0, importer.lastIndexOf('/')) : '';
  const target = specifier.startsWith('/')
    ? normalizePath(specifier.slice(1))
    : normalizePath(`${baseDir}/${specifier}`);

  const candidates = [
    target,
    `${target}.ts`,
    `${target}.js`,
    `${target}.mjs`,
    `${target}.cjs`,
    `${target}/index.ts`,
    `${target}/index.js`,
    `${target}/index.mjs`,
  ];

  for (const candidate of candidates) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const response = await fetch(WASM_URL);
      if (!response.ok) {
        throw new Error(`Falha ao baixar o empacotador JS: HTTP ${response.status}`);
      }
      const totalBytes = Number(response.headers.get('content-length') || 0) || WASM_FALLBACK_BYTES;
      let doneBytes = 0;
      if (!response.body) {
        await response.arrayBuffer();
        doneBytes = totalBytes;
        post({ type: 'init_progress', doneBytes, totalBytes, percent: 100 });
      } else {
        const reader = response.body.getReader();
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          doneBytes += chunk.value.length;
          post({
            type: 'init_progress',
            doneBytes,
            totalBytes,
            percent: Math.min(100, Math.round((doneBytes / totalBytes) * 100)),
          });
        }
      }
      await esbuild.initialize({ wasmURL: WASM_URL, worker: false });
    })();
  }
  return initPromise;
}

function createWorkspacePlugin(files: Map<string, string>): esbuild.Plugin {
  return {
    name: 'theprog-workspace',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        // Arquivo de entrada (sem importer): caminho direto no workspace
        if (!args.importer) {
          if (files.has(args.path)) {
            return { path: args.path, namespace: 'theprog-workspace' };
          }
          return {
            errors: [{ text: `Arquivo de entrada "${args.path}" não encontrado no workspace.` }],
          };
        }

        if (args.path.startsWith('http://') || args.path.startsWith('https://')) {
          return {
            errors: [{ text: `Importação remota não é suportada: "${args.path}"` }],
          };
        }
        if (args.path.endsWith('.json')) {
          return {
            errors: [{ text: `Importação de JSON ainda não é suportada: "${args.path}"` }],
          };
        }
        if (!args.path.startsWith('.') && !args.path.startsWith('/')) {
          return {
            errors: [
              {
                text: `Módulo "${args.path}" não é suportado. Use apenas arquivos locais do projeto (./arquivo).`,
              },
            ],
          };
        }
        const resolved = resolveWorkspaceModule(args.path, args.importer, files);
        if (!resolved) {
          return {
            errors: [{ text: `Módulo "${args.path}" não encontrado no workspace.` }],
          };
        }
        return { path: resolved, namespace: 'theprog-workspace' };
      });

      build.onLoad({ filter: /.*/, namespace: 'theprog-workspace' }, (args) => {
        const contents = files.get(args.path) ?? '';
        const loader: esbuild.Loader = args.path.endsWith('.ts') ? 'ts' : 'js';
        return { contents, loader, resolveDir: '/' };
      });
    },
  };
}

self.onmessage = async (event: MessageEvent) => {
  const message = event.data;

  if (message.type === 'init') {
    try {
      await ensureInitialized();
      post({ type: 'init_done' });
    } catch (err: any) {
      initPromise = null;
      post({ type: 'init_error', error: err?.message || String(err) });
    }
    return;
  }

  if (message.type === 'bundle') {
    const { id, entry, files: filesArray } = message;
    const files = new Map<string, string>(filesArray as [string, string][]);

    try {
      await ensureInitialized();
      const result = await esbuild.build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'iife',
        target: 'es2020',
        platform: 'browser',
        logLevel: 'silent',
        sourcemap: false,
        plugins: [createWorkspacePlugin(files)],
      });
      const code = result.outputFiles?.[0]?.text ?? '';
      post({ type: 'bundle_done', id, code });
    } catch (err: any) {
      const errors = Array.isArray(err?.errors)
        ? err.errors.map((e: any) => ({
            text: e?.text || String(e),
            file: e?.location?.file,
            line: e?.location?.line,
            column: e?.location?.column,
          }))
        : [{ text: err?.message || String(err) }];
      post({ type: 'bundle_error', id, errors });
    }
    return;
  }
};
