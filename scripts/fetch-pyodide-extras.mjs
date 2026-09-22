/**
 * Vendoriza wheels puras necessárias para uso offline do Python:
 *  - micropip (instalador de pacotes, vem da distribuição oficial do Pyodide)
 *  - black + dependências puras (formatador, vem do PyPI)
 *
 * Uso: node scripts/fetch-pyodide-extras.mjs [--force]
 * Saída: public/runtimes/pyodide-extras/*.whl + manifest.json
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'runtimes', 'pyodide-extras');
const FORCE = process.argv.includes('--force');

const PYPI_ORDER = [
  'click',
  'mypy-extensions',
  'packaging',
  'pathspec',
  'platformdirs',
  'pytokens',
  'black',
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

async function fetchPyodideLock() {
  const lockPath = path.join(ROOT, 'node_modules', 'pyodide', 'pyodide-lock.json');
  const pkgPath = path.join(ROOT, 'node_modules', 'pyodide', 'package.json');
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  lock.info.version = pkg.version;
  return lock;
}

async function fetchPypiWheel(name) {
  const res = await fetch(`https://pypi.org/pypi/${name}/json`);
  if (!res.ok) throw new Error(`PyPI indisponível para ${name}: HTTP ${res.status}`);
  const data = await res.json();
  const wheel = (data.urls || []).find(
    (u) => u.packagetype === 'bdist_wheel' && u.filename.endsWith('py3-none-any.whl')
  );
  if (!wheel) throw new Error(`Nenhuma wheel pura (py3-none-any) encontrada para ${name}`);
  return {
    name: data.info.name,
    version: data.info.version,
    fileName: wheel.filename,
    url: wheel.url,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const lock = await fetchPyodideLock();
  const pyodideVersion = lock.info.version;
  const cdn = `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`;

  const packages = [];

  const visitPyodidePackage = (name) => {
    const pkg = lock.packages[name];
    if (!pkg) throw new Error(`Pacote '${name}' ausente no pyodide-lock.json`);
    (pkg.depends || []).forEach(visitPyodidePackage);
    packages.push({
      name: pkg.name,
      version: pkg.version,
      fileName: pkg.file_name,
      source: 'pyodide',
      url: `${cdn}${pkg.file_name}`,
    });
  };
  visitPyodidePackage('micropip');

  for (const name of PYPI_ORDER) {
    const wheel = await fetchPypiWheel(name);
    packages.push({
      name: wheel.name,
      version: wheel.version,
      fileName: wheel.fileName,
      source: 'pypi',
      url: wheel.url,
    });
  }

  const manifestPackages = [];
  for (const pkg of packages) {
    const dest = path.join(OUT_DIR, pkg.fileName);
    if (FORCE || !(await exists(dest))) {
      const bytes = await download(pkg.url, dest);
      console.log(`Baixado: ${pkg.fileName} (${(bytes / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`Já existe: ${pkg.fileName}`);
    }
    manifestPackages.push({
      name: pkg.name,
      version: pkg.version,
      fileName: pkg.fileName,
      source: pkg.source,
    });
  }

  const manifest = {
    pyodideVersion,
    generatedAt: new Date().toISOString(),
    packages: manifestPackages,
  };
  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Manifest gravado com ${manifestPackages.length} pacotes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
