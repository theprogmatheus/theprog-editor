import { openDB, type IDBPDatabase } from 'idb';
import type { FileItem, UserSettings } from '../types/editor';

const DB_NAME = 'theprog-editor-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export const defaultSettings: UserSettings = {
  fontSize: 14,
  tabSize: 4,
  minimap: true,
  theme: 'dark',
  autoSave: true,
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
