import {
  compileC,
  executeWasmBinary,
  preloadCompiler,
  subscribeCompilerProgress,
  getCompilerProgress,
  terminateCompilerWorker,
  type CompilerProgress,
} from '../cCompiler';
import type { RunPlan } from '../languages/types';
import type { RuntimeAdapter, RuntimeProgress } from './types';

const encoder = new TextEncoder();
const SOURCE_REGEX = /\.(c|cpp|cc|cxx)$/i;
const MAIN_REGEX = /\b(?:int|void)\s+main\s*\(/;

function toRuntimeProgress(progress: CompilerProgress): RuntimeProgress {
  return {
    status: progress.status === 'preloading' ? 'loading' : progress.status,
    percent: progress.percent,
    doneBytes: progress.doneBytes,
    totalBytes: progress.totalBytes,
    error: progress.error,
  };
}

export const clangRuntime: RuntimeAdapter = {
  id: 'clang',
  label: 'C/C++ (Clang)',

  preload: () => preloadCompiler(),

  getProgress: () => toRuntimeProgress(getCompilerProgress()),

  subscribeProgress: (listener) =>
    subscribeCompilerProgress((progress) => listener(toRuntimeProgress(progress))),

  terminate: () => terminateCompilerWorker(),

  run: async (plan: RunPlan, io) => {
    const sources: string[] = [plan.entryFile];

    plan.files.forEach((content, name) => {
      if (name !== plan.entryFile && SOURCE_REGEX.test(name)) {
        if (!MAIN_REGEX.test(content)) {
          sources.push(name);
        }
      }
    });

    const isCpp = /\.(cpp|cc|cxx)$/i.test(plan.entryFile);
    const compilerCmd = isCpp ? 'clang++' : 'clang';
    const binaryName = plan.entryFile.replace(/\.[^/.]+$/, '');

    io.onEnvironmentOutput(
      `\x1b[90m$ ${compilerCmd} -O0 ${sources.join(' ')} -o ${binaryName}.wasm\x1b[0m\r\n`
    );

    const { wasmBinary, wasCached } = await compileC(
      sources,
      plan.files,
      binaryName,
      (out) => io.onEnvironmentOutput(out),
      plan.args || []
    );

    if (!wasmBinary) {
      io.onEnvironmentOutput(
        '\r\n\x1b[31m[Falha na compilação: verifique os erros acima]\x1b[0m\r\n'
      );
      return 1;
    }

    io.onEnvironmentOutput(
      `\x1b[32m[Compilação concluída com sucesso${wasCached ? ' (cached)' : ''}]\x1b[0m\r\n`
    );
    io.onMeta?.({ cached: wasCached });
    io.onPhaseChange('execution');

    const vfsFiles = Array.from(plan.files.entries()).map(([path, content]) => ({
      path,
      data: encoder.encode(content),
    }));

    const exitCode = await executeWasmBinary(binaryName, wasmBinary, {
      onOutput: (out) => io.onOutput(out),
      onNeedStdin: () => io.onNeedStdin(),
      onControllerReady: (controller) => io.onControllerReady(controller),
      vfsFiles,
      onFsSync: (files) => io.onFsSync?.(files),
    });

    return exitCode;
  },
};
