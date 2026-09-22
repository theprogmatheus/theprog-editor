import type { FileKind, LanguageId, RuntimeId } from './types';

export interface LanguageDefinition {
  id: LanguageId;
  label: string;
  extensions: string[];
  monacoId: string;
  runtime: RuntimeId | null;
  executable: boolean;
}

const DEFINITIONS: LanguageDefinition[] = [
  { id: 'c', label: 'C', extensions: ['.c'], monacoId: 'c', runtime: 'clang', executable: true },
  {
    id: 'cpp',
    label: 'C++',
    extensions: ['.cpp', '.cc', '.cxx'],
    monacoId: 'cpp',
    runtime: 'clang',
    executable: true,
  },
  {
    id: 'h',
    label: 'Cabeçalho C/C++',
    extensions: ['.h', '.hpp', '.hh', '.hxx'],
    monacoId: 'cpp',
    runtime: null,
    executable: false,
  },
  { id: 'python', label: 'Python', extensions: ['.py'], monacoId: 'python', runtime: 'python', executable: true },
  {
    id: 'javascript',
    label: 'JavaScript',
    extensions: ['.js', '.mjs', '.cjs'],
    monacoId: 'javascript',
    runtime: 'js',
    executable: true,
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    extensions: ['.ts'],
    monacoId: 'typescript',
    runtime: 'js',
    executable: true,
  },
  {
    id: 'markdown',
    label: 'Markdown',
    extensions: ['.md', '.markdown'],
    monacoId: 'markdown',
    runtime: null,
    executable: false,
  },
  { id: 'plaintext', label: 'Texto', extensions: [], monacoId: 'plaintext', runtime: null, executable: false },
];

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.ico',
  '.avif',
  '.tif',
  '.tiff',
]);

const BINARY_EXTENSIONS = new Set([
  '.pdf',
  '.zip',
  '.rar',
  '.7z',
  '.gz',
  '.tar',
  '.bz2',
  '.xz',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.o',
  '.obj',
  '.a',
  '.lib',
  '.class',
  '.jar',
  '.war',
  '.pyc',
  '.pyo',
  '.wasm',
  '.bin',
  '.dat',
  '.db',
  '.sqlite',
  '.mp3',
  '.wav',
  '.ogg',
  '.flac',
  '.mp4',
  '.avi',
  '.mov',
  '.mkv',
  '.webm',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',
  '.psd',
  '.ai',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.iso',
  '.img',
  '.apk',
  '.deb',
  '.rpm',
  '.dmg',
  '.msi',
]);

export function getFileExtension(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot === -1 ? '' : lower.slice(dot);
}

export function detectLanguage(filename: string): LanguageId {
  const ext = getFileExtension(filename);
  for (const def of DEFINITIONS) {
    if (def.extensions.includes(ext)) {
      return def.id;
    }
  }
  return 'plaintext';
}

export function getLanguageDefinition(id: LanguageId): LanguageDefinition {
  return DEFINITIONS.find((def) => def.id === id) || DEFINITIONS[DEFINITIONS.length - 1];
}

export function getMonacoLanguage(id: LanguageId): string {
  return getLanguageDefinition(id).monacoId;
}

export function getRuntimeForLanguage(id: LanguageId): RuntimeId | null {
  return getLanguageDefinition(id).runtime;
}

export function isExecutableLanguage(id: LanguageId): boolean {
  return getLanguageDefinition(id).executable;
}

/**
 * Detecta o tipo de arquivo apenas pela extensão.
 * Retorna null quando é necessário inspecionar o conteúdo (sniff).
 */
export function detectFileKindByExtension(filename: string): FileKind | null {
  const ext = getFileExtension(filename);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (BINARY_EXTENSIONS.has(ext)) return 'binary';
  if (ext === '.svg' || ext === '.md' || ext === '.markdown' || ext === '.json' || ext === '.xml' || ext === '.txt') {
    return 'text';
  }
  return null;
}

/**
 * Sniff de conteúdo: arquivos com byte NUL ou UTF-8 inválido são tratados como binários.
 */
export function detectFileKindFromBytes(bytes: Uint8Array): FileKind {
  if (bytes.length === 0) return 'text';
  const sample = bytes.length > 8192 ? bytes.subarray(0, 8192) : bytes;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return 'binary';
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
    return 'text';
  } catch {
    return 'binary';
  }
}

export function isTextFileKind(kind: FileKind | undefined): boolean {
  return kind === undefined || kind === 'text';
}

export function isLikelyBinaryByName(filename: string): boolean {
  const kind = detectFileKindByExtension(filename);
  return kind === 'binary' || kind === 'image';
}
