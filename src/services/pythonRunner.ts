export interface PythonExecutionCallbacks {
  onOutput: (text: string) => void;
  onControllerReady?: (controller: { abort: () => void }) => void;
}

let brythonLoaded = false;
let brythonLoadingPromise: Promise<void> | null = null;

async function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = (e) => reject(new Error(`Falha ao carregar script ${src}: ${e}`));
    document.head.appendChild(s);
  });
}

async function ensureBrython(): Promise<void> {
  if (brythonLoaded) return;
  if (brythonLoadingPromise) return brythonLoadingPromise;

  brythonLoadingPromise = (async () => {
    await loadScript(`${import.meta.env.BASE_URL}brython/brython.js`);
    await loadScript(`${import.meta.env.BASE_URL}brython/brython_stdlib.js`);
    if ((window as any).brython) {
      (window as any).brython();
    }
    brythonLoaded = true;
  })();

  return brythonLoadingPromise;
}

export async function executePythonCode(
  filename: string,
  rawCode: string,
  callbacks: PythonExecutionCallbacks
): Promise<number> {
  const { onOutput, onControllerReady } = callbacks;

  let aborted = false;
  if (onControllerReady) {
    onControllerReady({
      abort: () => {
        aborted = true;
        onOutput('\r\n\x1b[31m[Execução Python interrompida]\x1b[0m\r\n');
      },
    });
  }

  try {
    onOutput('\x1b[90m[Carregando interpretador Python 3...]\x1b[0m\r\n');
    await ensureBrython();

    if (aborted) return 130;

    const b = (window as any).__BRYTHON__;
    if (!b || typeof b.run_script !== 'function') {
      throw new Error('Ambiente Python Brython não disponível');
    }

    // Registra callbacks no globalThis para o script Python chamar
    (window as any)._theprog_python_stdout = (text: string) => {
      if (!aborted) {
        onOutput(text.replace(/\r?\n/g, '\r\n'));
      }
    };

    (window as any)._theprog_python_stderr = (text: string) => {
      if (!aborted) {
        onOutput(`\x1b[31m${text.replace(/\r?\n/g, '\r\n')}\x1b[0m`);
      }
    };

    const wrapperPython = `
import sys
from browser import window

class _TheProgStdout:
    def write(self, s):
        window._theprog_python_stdout(str(s))
    def flush(self):
        pass

class _TheProgStderr:
    def write(self, s):
        window._theprog_python_stderr(str(s))
    def flush(self):
        pass

sys.stdout = _TheProgStdout()
sys.stderr = _TheProgStderr()

# Codigo do usuario:
${rawCode}
`;

    b.run_script(wrapperPython, '__main__');
    return 0;
  } catch (err: any) {
    const msg = err?.message || String(err);
    onOutput(`\r\n\x1b[31mTraceback (most recent call last):\r\n  File "${filename}"\r\n${msg}\x1b[0m\r\n`);
    return 1;
  }
}
