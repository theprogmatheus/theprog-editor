import type { FileItem } from '../types/editor';
import type { RunPlan } from '../services/languages/types';
import { getRuntimeForLanguage } from '../services/languages/registry';

export function getFileRunPlan(
  file: FileItem,
  files: Map<string, string>,
  compilerFlags: string[] = []
): RunPlan | null {
  const runtime = getRuntimeForLanguage(file.language);
  if (!runtime) return null;

  const statusMessage =
    runtime === 'clang'
      ? `Compilando ${file.name}...`
      : runtime === 'python'
      ? `Interpretando ${file.name}...`
      : `Executando ${file.name}...`;

  const cleanEntry = file.path.startsWith('/') ? file.path.slice(1) : file.path;

  return {
    runtime,
    language: file.language,
    entryFile: cleanEntry,
    files,
    args: runtime === 'clang' ? compilerFlags : undefined,
    statusMessage,
  };
}
