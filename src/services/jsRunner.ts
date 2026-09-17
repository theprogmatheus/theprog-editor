export interface JsExecutionCallbacks {
  onOutput: (text: string) => void;
  onControllerReady?: (controller: { abort: () => void }) => void;
}

export async function executeJsCode(
  filename: string,
  rawCode: string,
  callbacks: JsExecutionCallbacks
): Promise<number> {
  const { onOutput, onControllerReady } = callbacks;

  let runnableCode = rawCode;
  const isTs = filename.endsWith('.ts') || filename.endsWith('.tsx');

  if (isTs) {
    try {
      const ts = await import('typescript');
      const result = ts.default.transpileModule(rawCode, {
        compilerOptions: {
          module: ts.default.ModuleKind.ESNext,
          target: ts.default.ScriptTarget.ES2022,
          jsx: ts.default.JsxEmit.React,
        },
      });
      runnableCode = result.outputText;
    } catch (err: any) {
      onOutput(`\r\n\x1b[31mErro de compilação TypeScript: ${err?.message || err}\x1b[0m\r\n`);
      return 1;
    }
  }

  return new Promise<number>((resolve) => {
    let finished = false;
    const worker = new Worker(new URL('../workers/jsWorker.ts', import.meta.url), {
      type: 'module',
    });

    const cleanup = () => {
      if (!finished) {
        finished = true;
        try {
          worker.terminate();
        } catch {}
      }
    };

    if (onControllerReady) {
      onControllerReady({
        abort: () => {
          cleanup();
        },
      });
    }

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'stdout') {
        onOutput(msg.text.replace(/\r?\n/g, '\r\n'));
      } else if (msg.type === 'exit') {
        cleanup();
        resolve(typeof msg.code === 'number' ? msg.code : 0);
      } else if (msg.type === 'error') {
        onOutput(`\r\n\x1b[31m${msg.error}\x1b[0m\r\n`);
        cleanup();
        resolve(1);
      }
    };

    worker.onerror = (err) => {
      onOutput(`\r\n\x1b[31mErro no runner JS: ${err?.message || 'Falha de execução'}\x1b[0m\r\n`);
      cleanup();
      resolve(1);
    };

    worker.postMessage({ code: runnableCode });
  });
}
