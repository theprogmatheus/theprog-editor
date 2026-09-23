import type { FileItem } from '../../types/editor';
import type { RunCapability } from './types';
import type { RuntimeProgress, RuntimeProgressMap } from '../runtimes/types';

const MAIN_FUNCTION_REGEX = /\b(?:int|void)\s+main\s*\(/;

function runtimeReason(progress: RuntimeProgress | undefined, label: string): string {
  if (!progress || progress.status === 'unloaded') {
    return `Ambiente ${label} ainda não foi inicializado`;
  }
  if (progress.status === 'error') {
    return `Ambiente ${label} falhou ao carregar: ${progress.error || 'erro desconhecido'}`;
  }
  return `Ambiente ${label} carregando (${Math.round(progress.percent)}%)...`;
}

function runtimeLabel(progress: RuntimeProgress | undefined, baseLabel: string): string {
  if (progress?.status === 'loading') {
    return `${baseLabel} (${Math.round(progress.percent || 0)}%)`;
  }
  return baseLabel;
}

export function getRunCapability(file: FileItem | null, runtimes: RuntimeProgressMap): RunCapability {
  const runLabel = 'Executar';

  if (!file || file.isFolder) {
    return { canRun: false, action: 'none', label: runLabel, reason: 'Nenhum arquivo aberto' };
  }

  if (file.kind === 'binary' || file.kind === 'image') {
    return { canRun: false, action: 'none', label: runLabel, reason: 'Visualização não suportada' };
  }

  switch (file.language) {
    case 'c':
    case 'cpp': {
      const compileLabel = 'Compilar & Executar';
      if (!MAIN_FUNCTION_REGEX.test(file.content || '')) {
        return {
          canRun: false,
          action: 'compile-run',
          label: compileLabel,
          reason: 'Nenhuma função main() encontrada neste arquivo',
        };
      }
      if (runtimes.clang?.status !== 'ready') {
        return {
          canRun: false,
          action: 'compile-run',
          label: runtimeLabel(runtimes.clang, compileLabel),
          reason: runtimeReason(runtimes.clang, 'C/C++'),
        };
      }
      return { canRun: true, action: 'compile-run', label: compileLabel };
    }

    case 'h':
      return {
        canRun: false,
        action: 'none',
        label: runLabel,
        reason: 'Arquivos de cabeçalho não são executáveis',
      };

    case 'python':
      if (runtimes.python?.status !== 'ready') {
        return {
          canRun: false,
          action: 'run',
          label: runtimeLabel(runtimes.python, runLabel),
          reason: runtimeReason(runtimes.python, 'Python'),
        };
      }
      return { canRun: true, action: 'run', label: runLabel };

    case 'javascript':
    case 'typescript':
      if (runtimes.js?.status !== 'ready') {
        return {
          canRun: false,
          action: 'run',
          label: runtimeLabel(runtimes.js, runLabel),
          reason: runtimeReason(runtimes.js, 'JavaScript/TypeScript'),
        };
      }
      return { canRun: true, action: 'run', label: runLabel };

    case 'markdown':
      return {
        canRun: false,
        action: 'none',
        label: runLabel,
        reason: 'Prévia de Markdown disponível em versão futura',
      };

    default:
      return {
        canRun: false,
        action: 'none',
        label: runLabel,
        reason: 'Linguagem não suportada para execução',
      };
  }
}
