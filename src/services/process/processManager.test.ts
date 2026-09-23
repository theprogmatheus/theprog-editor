import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProcessManager } from './processManager';
import { runtimeManager } from '../runtimes/manager';
import type { RunPlan } from '../languages/types';

vi.mock('../runtimes/manager', () => ({
  runtimeManager: {
    run: vi.fn(),
    terminate: vi.fn(),
  },
}));

describe('ProcessManager', () => {
  let pm: ProcessManager;

  beforeEach(() => {
    vi.clearAllMocks();
    pm = new ProcessManager();
  });

  const dummyPlan: RunPlan = {
    runtime: 'js',
    language: 'javascript',
    entryFile: 'index.js',
    files: new Map([['index.js', 'console.log("hello");']]),
    statusMessage: 'Executando JS',
  };

  it('inicializa sem processo ativo e status idle', () => {
    expect(pm.getActiveProcess()).toBeNull();
    expect(pm.isRunning()).toBe(false);
  });

  it('spawna um novo processo atribuindo PID monotônico e finaliza com métricas', async () => {
    vi.mocked(runtimeManager.run).mockImplementation(async (_runtime, _plan, io) => {
      io.onOutput('Test output\n');
      return 0;
    });

    const onOutput = vi.fn();
    const onStatusChange = vi.fn();
    const onMetrics = vi.fn();

    const exitPromise = pm.spawn(dummyPlan, {
      onOutput,
      onEnvironmentOutput: vi.fn(),
      onPhaseChange: vi.fn(),
      onStatusChange,
      onMetrics,
    });

    const active = pm.getActiveProcess();
    expect(active).not.toBeNull();
    expect(active?.pid).toBe(1);
    expect(active?.status).toBe('running');
    expect(pm.isRunning()).toBe(true);

    const exitCode = await exitPromise;
    expect(exitCode).toBe(0);
    expect(onOutput).toHaveBeenCalledWith('Test output\n');
    expect(onMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: expect.any(Number) })
    );
    expect(pm.getActiveProcess()).toBeNull();
    expect(pm.isRunning()).toBe(false);

    // Próximo processo deve ter PID 2
    const nextPromise = pm.spawn(dummyPlan, {
      onOutput: vi.fn(),
      onEnvironmentOutput: vi.fn(),
      onPhaseChange: vi.fn(),
      onStatusChange: vi.fn(),
    });
    expect(pm.getActiveProcess()?.pid).toBe(2);
    await nextPromise;
  });

  it('ignora mensagens e saída caso o processo já tenha sido terminado', async () => {
    let capturedIO: any = null;
    vi.mocked(runtimeManager.run).mockImplementation(async (_runtime, _plan, io) => {
      capturedIO = io;
      // Simula execução demorada
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 0;
    });

    const onOutput = vi.fn();
    const spawnPromise = pm.spawn(dummyPlan, {
      onOutput,
      onEnvironmentOutput: vi.fn(),
      onPhaseChange: vi.fn(),
      onStatusChange: vi.fn(),
    });

    // Interrompe imediatamente o processo
    pm.terminate();
    expect(runtimeManager.terminate).toHaveBeenCalledWith('js');
    expect(pm.getActiveProcess()).toBeNull();

    // Emissão atrasada vinda do runtime
    capturedIO?.onOutput('Mensagem atrasada após descarte');
    expect(onOutput).not.toHaveBeenCalled();

    await spawnPromise;
  });

  it('enfileira entradas na fila FIFO para stdin interativo', async () => {
    let capturedIO: any = null;
    vi.mocked(runtimeManager.run).mockImplementation(async (_runtime, _plan, io) => {
      capturedIO = io;
      return 0;
    });

    const spawnPromise = pm.spawn(dummyPlan, {
      onOutput: vi.fn(),
      onEnvironmentOutput: vi.fn(),
      onPhaseChange: vi.fn(),
      onStatusChange: vi.fn(),
    });

    const mockController = {
      sendStdin: vi.fn(),
      abort: vi.fn(),
    };
    capturedIO.onControllerReady(mockController);

    // Simula necessidade de stdin
    capturedIO.onNeedStdin();
    const active = pm.getActiveProcess();
    expect(active?.isAwaitingInput).toBe(true);

    // Simula colagem multi-linha
    pm.sendInput('linha1\nlinha2\n');
    expect(mockController.sendStdin).toHaveBeenCalledWith('linha1\n');

    // Worker consome a primeira e pede a próxima
    capturedIO.onNeedStdin();
    expect(mockController.sendStdin).toHaveBeenCalledWith('linha2\n');

    await spawnPromise;
  });
});
