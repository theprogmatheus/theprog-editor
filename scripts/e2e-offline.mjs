/**
 * Verificação E2E de execução offline (Service Worker + runtimes).
 *
 * Uso:
 *   npm run build
 *   node scripts/e2e-offline.mjs
 *
 * O script sobe o `vite preview` local, instala o Service Worker, aguarda o
 * precache e então simula falta de internet via CDP para executar JavaScript
 * e Python offline de verdade.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'http://localhost:4173/theprog-editor/';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Chrome/Edge não encontrado. Defina CHROME_PATH.');
}

async function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // servidor ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

async function waitForRuntimes(page, label, timeoutMs = 180000) {
  await page.waitForFunction(() => Boolean(window.__theprogDebug), { timeout: 60000 });
  const deadline = Date.now() + timeoutMs;
  let lastSummary = '';

  while (Date.now() < deadline) {
    const progress = await page.evaluate(() => {
      const current = window.__theprogDebug.runtimeManager.getProgress();
      return Object.fromEntries(
        Object.entries(current).map(([id, value]) => [
          id,
          { status: value.status, percent: value.percent, error: value.error || null },
        ])
      );
    });

    const summary = JSON.stringify(progress);
    if (summary !== lastSummary) {
      console.log(`  [${label}]`, summary);
      lastSummary = summary;
    }

    const allReady = ['clang', 'python', 'js'].every(
      (id) => progress[id]?.status === 'ready'
    );
    if (allReady) return progress;

    const errorEntry = Object.entries(progress).find(([, value]) => value.status === 'error');
    if (errorEntry) {
      throw new Error(`Runtime '${errorEntry[0]}' falhou offline: ${errorEntry[1].error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(`Runtimes não ficaram prontos em '${label}'`);
}

async function runLanguage(page, language) {
  return page.evaluate(async (lang) => {
    const { jsRuntime, pythonRuntime, runtimeManager } = window.__theprogDebug;
    const outputs = [];
    const io = {
      onOutput: (text) => outputs.push(text),
      onEnvironmentOutput: (text) => outputs.push(text),
      onPhaseChange: () => {},
      onNeedStdin: () => {},
      onControllerReady: () => {},
    };

    if (lang === 'c') {
      const code =
        '#include <stdio.h>\nint main() { printf("OFFLINE-C-OK\\n"); return 0; }';
      const exitCode = await runtimeManager.run(
        'clang',
        {
          runtime: 'clang',
          language: 'c',
          entryFile: 'main.c',
          files: new Map([['main.c', code]]),
          args: ['-O0'],
          statusMessage: 'e2e',
        },
        io
      );
      return { exitCode, text: outputs.join('') };
    }

    const runtime = lang === 'python' ? pythonRuntime : jsRuntime;
    const entryFile = lang === 'js' ? 'main.js' : lang === 'ts' ? 'main.ts' : 'main.py';
    const code =
      lang === 'js'
        ? 'console.log("OFFLINE-JS-OK");'
        : lang === 'ts'
        ? 'const msg: string = "OFFLINE-TS-OK";\nconsole.log(msg);'
        : 'print("OFFLINE-PY-OK")';
    const exitCode = await runtime.run(
      {
        runtime: lang === 'python' ? 'python' : 'js',
        language: lang === 'js' ? 'javascript' : lang === 'ts' ? 'typescript' : 'python',
        entryFile,
        files: new Map([[entryFile, code]]),
        statusMessage: 'e2e',
      },
      io
    );
    return { exitCode, text: outputs.join('') };
  }, language);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ✘ FALHOU: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${message}`);
  }
}

const preview = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'],
  { cwd: ROOT, stdio: 'ignore' }
);

let browser;
try {
  await waitForServer(BASE_URL);
  console.log('Servidor de preview ativo.');

  browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    protocolTimeout: 600000,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [console.error]', msg.text().slice(0, 300));
  });

  console.log('\n=== FASE 1: online (instala SW e precacheia tudo) ===');
  await page.goto(`${BASE_URL}?debug=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  console.log('  Service Worker ativo (precache concluído).');
  await waitForRuntimes(page, 'online');

  const onlineJs = await runLanguage(page, 'js');
  assert(onlineJs.exitCode === 0 && onlineJs.text.includes('OFFLINE-JS-OK'), 'JS online executou');

  console.log('  Instalando pacote Python (requests) online para cachear as wheels...');
  const installOnline = await page.evaluate(async () => {
    try {
      await window.__theprogDebug.pythonRuntime.installPackages(['requests'], () => {});
      return 'ok';
    } catch (error) {
      return `erro: ${error.message}`;
    }
  });
  console.log('  install online:', installOnline);

  const client = await page.createCDPSession();
  await client.send('Network.enable');

  console.log('\n=== FASE 2: offline (recarrega e executa do cache) ===');
  await client.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  // Limpa o cache HTTP: a partir daqui SOMENTE o cache do Service Worker pode servir assets.
  await client.send('Network.clearBrowserCache');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });

  const isolation = await page.evaluate(() => ({
    crossOriginIsolated: window.crossOriginIsolated,
    controlled: Boolean(navigator.serviceWorker.controller),
    online: navigator.onLine,
  }));
  console.log('  Estado offline:', isolation);
  assert(isolation.online === false, 'navegador está offline');
  assert(isolation.controlled, 'página controlada pelo Service Worker');
  assert(isolation.crossOriginIsolated, 'crossOriginIsolated ativo (SharedArrayBuffer disponível)');

  const assets = await page.evaluate(async () => {
    const urls = [
      'runtimes/esbuild/esbuild.wasm',
      'runtimes/pyodide/pyodide.mjs',
      'runtimes/pyodide/pyodide.asm.mjs',
      'runtimes/pyodide/pyodide.asm.wasm',
      'runtimes/pyodide/python_stdlib.zip',
      'runtimes/pyodide/pyodide-lock.json',
      'runtimes/pyodide-extras/manifest.json',
      'runtimes/pyodide-extras/black-26.5.1-py3-none-any.whl',
    ];
    const result = {};
    for (const url of urls) {
      try {
        const response = await fetch(url);
        result[url] = response.status;
      } catch (error) {
        result[url] = `erro: ${error.message}`;
      }
    }
    return result;
  });
  for (const [url, status] of Object.entries(assets)) {
    assert(status === 200, `asset em cache offline: ${url} (${status})`);
  }

  await waitForRuntimes(page, 'offline');

  const results = {
    C: await runLanguage(page, 'c'),
    JS: await runLanguage(page, 'js'),
    TS: await runLanguage(page, 'ts'),
    Python: await runLanguage(page, 'python'),
  };

  const expectations = {
    C: 'OFFLINE-C-OK',
    JS: 'OFFLINE-JS-OK',
    TS: 'OFFLINE-TS-OK',
    Python: 'OFFLINE-PY-OK',
  };

  for (const [name, result] of Object.entries(results)) {
    console.log(`  ${name}: exit=${result.exitCode} | saída: ${JSON.stringify(result.text.slice(0, 300))}`);
    assert(
      result.exitCode === 0 && result.text.includes(expectations[name]),
      `${name} offline executou (exit=${result.exitCode})`
    );
  }

  console.log('  Reinstalando pacote Python (requests) offline a partir do cache...');
  const installOffline = await page.evaluate(async () => {
    try {
      await window.__theprogDebug.pythonRuntime.installPackages(['requests'], () => {});
      return 'ok';
    } catch (error) {
      return `erro: ${error.message}`;
    }
  });
  assert(installOffline === 'ok', `pacote Python (requests) instalado offline (${installOffline})`);

  const requestsRun = await page.evaluate(async () => {
    const outputs = [];
    const exitCode = await window.__theprogDebug.pythonRuntime.run(
      {
        runtime: 'python',
        language: 'python',
        entryFile: 'req.py',
        files: new Map([['req.py', 'import requests\nprint("REQUESTS-OFFLINE-OK", requests.__version__)']]),
        statusMessage: 'e2e',
      },
      {
        onOutput: (text) => outputs.push(text),
        onEnvironmentOutput: (text) => outputs.push(text),
        onPhaseChange: () => {},
        onNeedStdin: () => {},
        onControllerReady: () => {},
      }
    );
    return { exitCode, text: outputs.join('') };
  });
  assert(
    requestsRun.exitCode === 0 && requestsRun.text.includes('REQUESTS-OFFLINE-OK'),
    `import requests offline funcionou (exit=${requestsRun.exitCode})`
  );
  if (!requestsRun.text.includes('REQUESTS-OFFLINE-OK')) {
    console.log('    saída requests:', JSON.stringify(requestsRun.text.slice(0, 300)));
  }
} catch (error) {
  console.error('Erro no E2E:', error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  preview.kill();
}

console.log(process.exitCode ? '\nRESULTADO: FALHOU' : '\nRESULTADO: TUDO OK');
