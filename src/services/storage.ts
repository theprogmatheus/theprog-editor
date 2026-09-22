import { openDB, type IDBPDatabase } from 'idb';
import type { FileItem, UserSettings, RecentWorkspace } from '../types/editor';

const DB_NAME = 'theprog-editor-db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase> | null = null;

export const defaultSettings: UserSettings = {
  fontSize: 14,
  tabSize: 4,
  minimap: true,
  theme: 'dark',
  autoSave: true,
  autoSaveDelay: 1500,
};

export const defaultFiles: FileItem[] = [
  {
    id: 'f-main-c',
    name: 'main.c',
    path: '/main.c',
    isFolder: false,
    parentId: null,
    language: 'c',
    updatedAt: Date.now(),
    content: `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`,
  },
  {
    id: 'f-main-py',
    name: 'main.py',
    path: '/main.py',
    isFolder: false,
    parentId: null,
    language: 'python',
    updatedAt: Date.now(),
    content: `def main():
    nome = input("Digite seu nome: ")
    print(f"Olá, {nome}! Bem-vindo ao TheProg Editor.")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: 'f-index-js',
    name: 'index.js',
    path: '/index.js',
    isFolder: false,
    parentId: null,
    language: 'javascript',
    updatedAt: Date.now(),
    content: `function main() {
  const nome = input("Digite seu nome: ");
  console.log(\`Olá, \${nome}! Bem-vindo ao TheProg Editor.\`);
}

main();
`,
  },
  {
    id: 'f-main-ts',
    name: 'main.ts',
    path: '/main.ts',
    isFolder: false,
    parentId: null,
    language: 'typescript',
    updatedAt: Date.now(),
    content: `function soma(a: number, b: number): number {
  return a + b;
}

console.log("2 + 3 =", soma(2, 3));
`,
  },
];

export async function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('parentId', 'parentId', { unique: false });
          fileStore.createIndex('path', 'path', { unique: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('vmCache')) {
          db.createObjectStore('vmCache');
        }
        if (!db.objectStoreNames.contains('recent_workspaces')) {
          db.createObjectStore('recent_workspaces', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('runtime_assets')) {
          db.createObjectStore('runtime_assets');
        }
      },
    });
  }
  return dbPromise;
}

export async function loadAllFiles(): Promise<FileItem[]> {
  const db = await getDb();
  const files = await db.getAll('files');
  if (!files || files.length === 0) {
    // Seed initial files
    const tx = db.transaction('files', 'readwrite');
    for (const file of defaultFiles) {
      await tx.store.put(file);
    }
    await tx.done;
    return defaultFiles;
  }
  return files;
}

export async function saveFileToStorage(file: FileItem): Promise<void> {
  const db = await getDb();
  await db.put('files', { ...file, updatedAt: Date.now() });
}

export async function deleteFileFromStorage(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('files', id);
}

export async function loadUserSettings(): Promise<UserSettings> {
  const db = await getDb();
  const settings = await db.get('settings', 'user-preferences');
  return settings ? { ...defaultSettings, ...settings } : defaultSettings;
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', settings, 'user-preferences');
}

export async function getRecentWorkspaces(): Promise<RecentWorkspace[]> {
  try {
    const db = await getDb();
    const workspaces: RecentWorkspace[] = await db.getAll('recent_workspaces');
    
    // Garante que o Sandbox sempre exista na lista de recentes
    const hasSandbox = workspaces.some((w) => w.id === 'sandbox');
    if (!hasSandbox) {
      const sandboxWs: RecentWorkspace = {
        id: 'sandbox',
        name: 'Sandbox Virtual',
        type: 'sandbox',
        path: 'Armazenamento interno do navegador',
        lastOpened: Date.now(),
      };
      await db.put('recent_workspaces', sandboxWs);
      workspaces.unshift(sandboxWs);
    }

    return workspaces.sort((a, b) => b.lastOpened - a.lastOpened);
  } catch (err) {
    console.error('Erro ao ler workspaces recentes:', err);
    return [
      {
        id: 'sandbox',
        name: 'Sandbox Virtual',
        type: 'sandbox',
        path: 'Armazenamento interno do navegador',
        lastOpened: Date.now(),
      },
    ];
  }
}

export async function saveRecentWorkspace(workspace: RecentWorkspace): Promise<void> {
  const payload = {
    ...workspace,
    lastOpened: Date.now(),
  };

  try {
    const db = await getDb();
    try {
      await db.put('recent_workspaces', payload);
    } catch (putErr) {
      // Em modo anônimo ou navegadores com restrições de IPC de FileSystemHandle no IDB
      console.warn('Não foi possível persistir handle no IndexedDB, salvando apenas metadados:', putErr);
      const safePayload = { ...payload };
      delete safePayload.handle;
      await db.put('recent_workspaces', safePayload);
    }
  } catch (err) {
    console.error('Erro ao salvar workspace recente:', err);
  }
}

export async function removeRecentWorkspace(id: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete('recent_workspaces', id);
  } catch (err) {
    console.error('Erro ao remover workspace recente:', err);
  }
}

export async function updateWorkspaceLastOpened(id: string): Promise<void> {
  try {
    const db = await getDb();
    const existing = await db.get('recent_workspaces', id);
    if (existing) {
      existing.lastOpened = Date.now();
      await db.put('recent_workspaces', existing);
    }
  } catch (err) {
    console.error('Erro ao atualizar data de acesso do workspace:', err);
  }
}

export async function getRuntimeAsset<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get('runtime_assets', key)) as T | undefined;
}

export async function setRuntimeAsset(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('runtime_assets', value, key);
}

export async function deleteRuntimeAsset(key: string): Promise<void> {
  const db = await getDb();
  await db.delete('runtime_assets', key);
}

export async function getRuntimeAssetKeys(prefix: string): Promise<string[]> {
  const db = await getDb();
  const keys = await db.getAllKeys('runtime_assets');
  return keys.map((key) => String(key)).filter((key) => key.startsWith(prefix));
}
