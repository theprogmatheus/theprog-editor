import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseTestCases, serializeTestCases, normalizeOutput, runSingleTestCase } from './testRunner';
import { processManager } from './process/processManager';

vi.mock('./process/processManager', () => ({
  processManager: {
    spawn: vi.fn(),
    terminate: vi.fn(),
  },
}));

describe('testRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('faz parse e serialização de casos de teste', () => {
    const raw = JSON.stringify([
      { id: 't1', title: 'Soma simples', stdin: '10 20\n', expectedStdout: '30\n' },
    ]);
    const parsed = parseTestCases(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Soma simples');
    expect(parsed[0].stdin).toBe('10 20\n');
    expect(parsed[0].expectedStdout).toBe('30\n');

    expect(serializeTestCases(parsed)).toContain('Soma simples');
  });

  it('normaliza strings eliminando espaços e quebras de linha supérfluas', () => {
    expect(normalizeOutput('30   \r\n')).toBe('30');
    expect(normalizeOutput('Linha 1  \nLinha 2\n\n')).toBe('Linha 1\nLinha 2');
  });

  it('avalia caso de teste como Accepted (AC) quando saídas combinam', async () => {
    vi.mocked(processManager.spawn).mockImplementation(async (_plan, io) => {
      io.onOutput('30\n');
      return 0;
    });

    const result = await runSingleTestCase(
      { runtime: 'js', language: 'javascript', entryFile: 'soma.js', files: new Map(), statusMessage: '' },
      { id: 't1', title: 'Caso 1', stdin: '10 20\n', expectedStdout: '30\n' }
    );

    expect(result.verdict).toBe('accepted');
    expect(result.exitCode).toBe(0);
  });

  it('avalia caso de teste como Wrong Answer (WA) quando saídas diferem', async () => {
    vi.mocked(processManager.spawn).mockImplementation(async (_plan, io) => {
      io.onOutput('25\n');
      return 0;
    });

    const result = await runSingleTestCase(
      { runtime: 'js', language: 'javascript', entryFile: 'soma.js', files: new Map(), statusMessage: '' },
      { id: 't1', title: 'Caso 1', stdin: '10 20\n', expectedStdout: '30\n' }
    );

    expect(result.verdict).toBe('wrong_answer');
    expect(result.actualStdout).toBe('25\n');
  });

  it('avalia caso de teste como Runtime Error (RE) quando exit code != 0', async () => {
    vi.mocked(processManager.spawn).mockImplementation(async (_plan, io) => {
      io.onOutput('Segmentation fault\n');
      return 1;
    });

    const result = await runSingleTestCase(
      { runtime: 'clang', language: 'c', entryFile: 'main.c', files: new Map(), statusMessage: '' },
      { id: 't1', title: 'Caso 1', stdin: '', expectedStdout: 'OK\n' }
    );

    expect(result.verdict).toBe('runtime_error');
  });
});
