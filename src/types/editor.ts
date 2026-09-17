export type SupportedLanguage =
  | 'c'
  | 'cpp'
  | 'h'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'html'
  | 'css'
  | 'json'
  | 'markdown'
  | 'shell'
  | 'rust'
  | 'go'
  | 'java'
  | 'sql'
  | 'makefile'
  | 'plaintext';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  content?: string;
  parentId: string | null;
  language: SupportedLanguage;
  updatedAt: number;
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
}
