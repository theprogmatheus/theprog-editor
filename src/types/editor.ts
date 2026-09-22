import type { FileKind, LanguageId } from '../services/languages/types';

export type SupportedLanguage = LanguageId;

export interface FileItem {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  content?: string;
  parentId: string | null;
  language: SupportedLanguage;
  updatedAt: number;
  kind?: FileKind;
  size?: number;
  handle?: FileSystemHandle;
}

export type WorkspaceType = 'sandbox' | 'local';

export interface RecentWorkspace {
  id: string;
  name: string;
  type: WorkspaceType;
  path?: string;
  handle?: FileSystemDirectoryHandle;
  lastOpened: number;
}

export interface ActiveWorkspace {
  type: WorkspaceType;
  name: string;
  handle?: FileSystemDirectoryHandle;
}

export interface EditorTab {
  fileId: string;
  filePath: string;
  title: string;
  language: SupportedLanguage;
  isDirty?: boolean;
}

export type ThemeMode = 'dark' | 'light';

export type VMStatus = 'idle' | 'downloading' | 'booting' | 'ready' | 'running' | 'error';

export interface VMConfig {
  memorySizeMb: number;
  useFallbackSimulator: boolean;
  alpineImageUrl?: string;
}

export interface UserSettings {
  fontSize: number;
  tabSize: number;
  minimap: boolean;
  theme: ThemeMode;
  autoSave: boolean;
  autoSaveDelay: number;
}
