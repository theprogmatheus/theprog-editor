const decoder = new TextDecoder('utf-8');

let control: Int32Array | null = null;
let data: Uint8Array | null = null;
let currentRunId = '';
let finished = true;

const timeoutIds = new Set<any>();
const intervalIds = new Set<any>();

const originalSetTimeout = globalThis.setTimeout.bind(globalThis);
const originalClearTimeout = globalThis.clearTimeout.bind(globalThis);
const originalSetInterval = globalThis.setInterval.bind(globalThis);
const originalClearInterval = globalThis.clearInterval.bind(globalThis);

function post(message: unknown): void {
  (self as unknown as { postMessage: (m: unknown) => void }).postMessage(message);
}

function writeStdout(text: string): void {
  if (text) post({ type: 'stdout', text });
}

function writeStderr(text: string): void {
  if (text) post({ type: 'stderr', text });
}

function formatValue(value: unknown, depth = 0): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') {
    return `[Function: ${(value as Function).name || 'anonymous'}]`;
  }
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (depth >= 3) return '[Object]';
  try {
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      },
      2
    );
  } catch {
    return String(value);
  }
}

function formatConsoleArgs(args: unknown[]): string {
  if (args.length === 0) return '';
  const [first, ...rest] = args;
  if (typeof first === 'string' && /%[sdifjo%]/.test(first)) {
    let index = 0;
    const interpolated = first.replace(/%[sdifjo%]/g, (token) => {
      if (token === '%%') return '%';
      if (index >= rest.length) return token;
      const value = rest[index++];
      if (token === '%d' || token === '%i') return String(Number(value));
      if (token === '%f') return String(Number(value));
      if (token === '%j') {
        try {
          return JSON.stringify(value);
        } catch {
          return '[Circular]';
        }
      }
      return formatValue(value);
    });
    const remaining = rest.slice(index).map((value) => formatValue(value));
    return [interpolated, ...remaining].join(' ');
  }
  return args.map((value) => formatValue(value)).join(' ');
}

function reportError(err: unknown): void {
  const text = err instanceof Error ? err.stack || `${err.name}: ${err.message}` : String(err);
  writeStderr(`\r\n\x1b[31m${text}\x1b[0m\r\n`);
}

function clearAllTimers(): void {
  timeoutIds.forEach((id) => originalClearTimeout(id));
  timeoutIds.clear();
  intervalIds.forEach((id) => originalClearInterval(id));
  intervalIds.clear();
}

function finish(code: number): void {
  if (finished) return;
  finished = true;
  clearAllTimers();
  post({ type: 'exit', id: currentRunId, code });
}

function scheduleFinishCheck(delay = 30): void {
  originalSetTimeout(() => {
    if (!finished && timeoutIds.size === 0 && intervalIds.size === 0) {
      finish(0);
    }
  }, delay);
}

function installTimerShims(): void {
  (globalThis as any).setTimeout = (fn: (...args: any[]) => void, ms?: number, ...args: any[]) => {
    const id = originalSetTimeout(() => {
      timeoutIds.delete(id);
      try {
        fn(...args);
      } catch (err) {
        reportError(err);
        finish(1);
        return;
      }
      scheduleFinishCheck();
    }, ms, ...args);
    timeoutIds.add(id);
    return id;
  };

  (globalThis as any).clearTimeout = (id: any) => {
    if (timeoutIds.delete(id)) {
      originalClearTimeout(id);
    }
  };

  (globalThis as any).setInterval = (fn: (...args: any[]) => void, ms?: number, ...args: any[]) => {
    const id = originalSetInterval(() => {
      try {
        fn(...args);
      } catch (err) {
        reportError(err);
        finish(1);
      }
    }, ms, ...args);
    intervalIds.add(id);
    return id;
  };

  (globalThis as any).clearInterval = (id: any) => {
    if (intervalIds.delete(id)) {
      originalClearInterval(id);
    }
  };
}

function readBlockingLine(): string | null {
  if (!control || !data) return null;
  post({ type: 'stdin_need' });
  Atomics.wait(control, 0, 0);
  const status = Atomics.load(control, 0);
  if (status === -1) {
    return null;
  }
  if (status === 1) {
    const length = Atomics.load(control, 1);
    const received = new Uint8Array(length);
    received.set(data.subarray(0, length));
    Atomics.store(control, 0, 0);
    return decoder.decode(received).replace(/\r?\n$/, '');
  }
  return null;
}

function sanitizeGlobalScope(): void {
  const dangerousProps = [
    'indexedDB',
    'caches',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'Worker',
    'SharedWorker',
    'BroadcastChannel',
    'openDatabase',
  ];

  for (const prop of dangerousProps) {
    try {
      Object.defineProperty(globalThis, prop, {
        configurable: false,
        enumerable: false,
        get() {
          throw new Error(
            `Acesso de segurança bloqueado: a API '${prop}' não é permitida no ambiente isolado do TheProg Editor.`
          );
        },
        set() {
          // Bloqueia sobrescrita
        },
      });
    } catch {
      try {
        delete (globalThis as any)[prop];
      } catch {}
    }
  }
}

function installGlobals(entry: string, argv: string[]): void {
  sanitizeGlobalScope();

  const consoleShim = {
    log: (...args: unknown[]) => writeStdout(formatConsoleArgs(args) + '\n'),
    info: (...args: unknown[]) => writeStdout(formatConsoleArgs(args) + '\n'),
    debug: (...args: unknown[]) => writeStdout(formatConsoleArgs(args) + '\n'),
    warn: (...args: unknown[]) => writeStderr(formatConsoleArgs(args) + '\n'),
    error: (...args: unknown[]) => writeStderr(formatConsoleArgs(args) + '\n'),
    trace: (...args: unknown[]) => writeStderr(formatConsoleArgs(args) + '\n'),
    table: (...args: unknown[]) => writeStdout(formatConsoleArgs(args) + '\n'),
  };

  const processShim = {
    argv: [entry, ...argv],
    env: {},
    platform: 'linux',
    version: 'v20.0.0',
    cwd: () => '/workspace',
    exit: (code?: number) => finish(typeof code === 'number' ? code : 0),
    stdout: { write: (chunk: unknown) => { writeStdout(String(chunk)); return true; } },
    stderr: { write: (chunk: unknown) => { writeStderr(String(chunk)); return true; } },
  };

  (globalThis as any).console = consoleShim;
  (globalThis as any).process = processShim;
  (globalThis as any).global = globalThis;
  (globalThis as any).input = () => readBlockingLine();
}

self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  if (finished) return;
  reportError(event.reason);
  finish(1);
});

self.onmessage = (event: MessageEvent) => {
  const message = event.data;
  if (message.type !== 'run') return;

  currentRunId = message.id;
  control = new Int32Array(message.sabControl, 0, 2);
  data = new Uint8Array(message.sabControl, 8);
  finished = false;

  installTimerShims();
  installGlobals(message.entry, message.argv || []);

  try {
    const result = (0, eval)(message.code);
    if (result && typeof result.then === 'function') {
      result
        .then(() => {
          scheduleFinishCheck();
        })
        .catch((err: any) => {
          reportError(err);
          finish(1);
        });
      return;
    }
  } catch (err) {
    reportError(err);
    finish(1);
    return;
  }

  scheduleFinishCheck();
};
