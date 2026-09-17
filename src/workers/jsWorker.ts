self.onmessage = async (e: MessageEvent) => {
  const { code } = e.data;

  const formatArg = (arg: any): string => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  };

  const send = (type: string, text: string) => {
    self.postMessage({ type, text });
  };

  // Intercepta console global
  (self as any).console = {
    log: (...args: any[]) => send('stdout', args.map(formatArg).join(' ') + '\n'),
    info: (...args: any[]) => send('stdout', args.map(formatArg).join(' ') + '\n'),
    warn: (...args: any[]) => send('stdout', `\x1b[33m${args.map(formatArg).join(' ')}\x1b[0m\n`),
    error: (...args: any[]) => send('stdout', `\x1b[31m${args.map(formatArg).join(' ')}\x1b[0m\n`),
  };

  // Suporte a emulação de process.stdout.write
  (self as any).process = {
    stdout: {
      write: (data: any) => send('stdout', String(data)),
    },
    stderr: {
      write: (data: any) => send('stdout', `\x1b[31m${String(data)}\x1b[0m`),
    },
    version: 'v20.10.0',
    platform: 'linux',
  };

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction(code);
    await fn();
    self.postMessage({ type: 'exit', code: 0 });
  } catch (err: any) {
    const errorMsg = err?.stack || err?.message || String(err);
    self.postMessage({ type: 'error', error: errorMsg });
  }
};
