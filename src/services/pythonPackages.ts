import type { ActiveWorkspace } from '../types/editor';
import {
  deleteRuntimeAsset,
  getRuntimeAsset,
  getRuntimeAssetKeys,
  setRuntimeAsset,
} from './storage';
import { readFileFromDisk, saveFileToDisk } from './localFs';
import type { InstalledWheel } from './runtimes/types';

const PY_PACKAGES_DIR = '.theprog/py-packages';
const MANIFEST_ASSET_KEY = 'py-manifest';
const WHEEL_ASSET_PREFIX = 'py-wheel:';

export interface PythonPackageEntry {
  name: string;
  version: string;
  fileName: string;
}

export interface PythonPackageManifest {
  pyodideVersion: string;
  packages: PythonPackageEntry[];
}

export interface CachedWheel {
  fileName: string;
  data: Uint8Array;
}

function getLocalHandle(workspace: ActiveWorkspace): FileSystemDirectoryHandle | null {
  return workspace.type === 'local' && workspace.handle ? workspace.handle : null;
}

async function readManifest(workspace: ActiveWorkspace): Promise<PythonPackageManifest | null> {
  const handle = getLocalHandle(workspace);
  if (handle) {
    const bytes = await readFileFromDisk(handle, `${PY_PACKAGES_DIR}/manifest.json`);
    if (!bytes) return null;
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as PythonPackageManifest;
    } catch {
      return null;
    }
  }
  return (await getRuntimeAsset<PythonPackageManifest>(MANIFEST_ASSET_KEY)) || null;
}

async function writeManifest(
  workspace: ActiveWorkspace,
  manifest: PythonPackageManifest
): Promise<void> {
  const handle = getLocalHandle(workspace);
  if (handle) {
    const data = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    await saveFileToDisk(handle, `${PY_PACKAGES_DIR}/manifest.json`, data);
    return;
  }
  await setRuntimeAsset(MANIFEST_ASSET_KEY, manifest);
}

export async function listPythonPackages(workspace: ActiveWorkspace): Promise<PythonPackageEntry[]> {
  const manifest = await readManifest(workspace);
  return manifest?.packages || [];
}

let saveWheelMutex = Promise.resolve();

export async function savePythonWheel(
  workspace: ActiveWorkspace,
  wheel: InstalledWheel,
  pyodideVersion: string
): Promise<void> {
  saveWheelMutex = saveWheelMutex.then(async () => {
    try {
      let manifest = await readManifest(workspace);
      if (!manifest || manifest.pyodideVersion !== pyodideVersion) {
        manifest = { pyodideVersion, packages: [] };
      }

      const handle = getLocalHandle(workspace);
      if (handle) {
        await saveFileToDisk(handle, `${PY_PACKAGES_DIR}/${wheel.fileName}`, wheel.data);
      } else {
        await setRuntimeAsset(`${WHEEL_ASSET_PREFIX}${wheel.fileName}`, {
          fileName: wheel.fileName,
          name: wheel.name,
          version: wheel.version,
          data: wheel.data,
        });
      }

      manifest.packages = [
        ...manifest.packages.filter((entry) => entry.fileName !== wheel.fileName),
        { name: wheel.name, version: wheel.version, fileName: wheel.fileName },
      ];
      await writeManifest(workspace, manifest);
    } catch (err) {
      console.warn('Não foi possível persistir a wheel do Python:', err);
    }
  });
  return saveWheelMutex;
}

export async function loadPythonWheels(
  workspace: ActiveWorkspace,
  pyodideVersion: string
): Promise<CachedWheel[]> {
  const manifest = await readManifest(workspace);
  if (!manifest || manifest.pyodideVersion !== pyodideVersion) return [];

  const wheels: CachedWheel[] = [];
  const handle = getLocalHandle(workspace);

  for (const entry of manifest.packages) {
    if (handle) {
      const bytes = await readFileFromDisk(handle, `${PY_PACKAGES_DIR}/${entry.fileName}`);
      if (bytes) wheels.push({ fileName: entry.fileName, data: bytes });
    } else {
      const asset = await getRuntimeAsset<{ data: Uint8Array }>(
        `${WHEEL_ASSET_PREFIX}${entry.fileName}`
      );
      if (asset?.data) {
        const data = asset.data instanceof Uint8Array ? asset.data : new Uint8Array(asset.data);
        wheels.push({ fileName: entry.fileName, data });
      }
    }
  }

  return wheels;
}

export async function removePythonPackage(
  workspace: ActiveWorkspace,
  fileName: string
): Promise<void> {
  const manifest = await readManifest(workspace);
  if (!manifest) return;
  manifest.packages = manifest.packages.filter((entry) => entry.fileName !== fileName);
  await writeManifest(workspace, manifest);
  const handle = getLocalHandle(workspace);
  if (!handle) {
    await deleteRuntimeAsset(`${WHEEL_ASSET_PREFIX}${fileName}`);
  }
}

export async function clearPythonPackages(workspace: ActiveWorkspace): Promise<void> {
  const handle = getLocalHandle(workspace);
  if (handle) {
    await writeManifest(workspace, { pyodideVersion: '', packages: [] });
    return;
  }
  const keys = await getRuntimeAssetKeys(WHEEL_ASSET_PREFIX);
  for (const key of keys) {
    await deleteRuntimeAsset(key);
  }
  await deleteRuntimeAsset(MANIFEST_ASSET_KEY);
}
