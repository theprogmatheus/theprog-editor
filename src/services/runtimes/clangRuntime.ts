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

import { resolveSources } from '../buildConfig';

const encoder = new TextEncoder();

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
    const resolution = resolveSources(plan.files, plan.entryFile);
    const sources = resolution.sources;
    const isCpp =
      resolution.customCompiler === 'clang++' ||
      /\.(cpp|cc|cxx)$/i.test(plan.entryFile);
    const compilerCmd = resolution.customCompiler || (isCpp ? 'clang++' : 'clang');
    const binaryName = plan.entryFile.replace(/\.[^/.]+$/, '');
    const flags = resolution.customFlags || plan.args || [];
    const flagsStr = flags.length > 0 ? ` ${flags.join(' ')}` : ' -O0';

    io.onEnvironmentOutput(
      `\x1b[90m$ ${compilerCmd}${flagsStr} ${sources.join(' ')} -o ${binaryName}.wasm\x1b[0m\r\n`
    );

    const { wasmBinary, wasCached } = await compileC(
      sources,
      plan.files,
      binaryName,
      (out) => io.onEnvironmentOutput(out),
      flags
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
