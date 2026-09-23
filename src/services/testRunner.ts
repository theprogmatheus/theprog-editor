import type { RunPlan } from './languages/types';
import { processManager } from './process/processManager';

export interface TestCase {
  id: string;
  title: string;
  stdin: string;
  expectedStdout: string;
  timeoutMs?: number;
}

export type TestVerdict =
  | 'pending'
  | 'running'
  | 'accepted'
  | 'wrong_answer'
  | 'time_limit'
  | 'runtime_error';

export interface TestResult {
  testId: string;
  verdict: TestVerdict;
  actualStdout: string;
  durationMs: number;
  exitCode?: number;
}

export const TESTS_CONFIG_PATH = '.theprog/tests.json';

export function parseTestCases(content: string): TestCase[] {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `test-${index + 1}`,
      title: typeof item.title === 'string' ? item.title : `Caso #${index + 1}`,
      stdin: typeof item.stdin === 'string' ? item.stdin : '',
      expectedStdout: typeof item.expectedStdout === 'string' ? item.expectedStdout : '',
      timeoutMs: typeof item.timeoutMs === 'number' ? item.timeoutMs : 3000,
    }));
  } catch {
    return [];
  }
}

export function serializeTestCases(tests: TestCase[]): string {
  return JSON.stringify(tests, null, 2);
}

export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Executa um caso de teste individual usando o ProcessManager.
 */
export async function runSingleTestCase(
  plan: RunPlan,
  test: TestCase
): Promise<TestResult> {
  let outputAccumulator = '';
  const startTime = performance.now();
  let timedOut = false;
  const timeoutMs = test.timeoutMs || 3000;

  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    processManager.terminate();
  }, timeoutMs);

  const exitCode = await processManager.spawn(plan, {
    onOutput: (text) => {
      outputAccumulator += text;
    },
    onEnvironmentOutput: () => {},
    onPhaseChange: () => {},
    onStatusChange: () => {},
  });

  clearTimeout(timeoutTimer);

  const durationMs = performance.now() - startTime;
  const actualClean = outputAccumulator.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');

  if (timedOut) {
    return {
      testId: test.id,
      verdict: 'time_limit',
      actualStdout: actualClean,
      durationMs,
      exitCode: 130,
    };
  }

  if (exitCode !== 0) {
    return {
      testId: test.id,
      verdict: 'runtime_error',
      actualStdout: actualClean,
      durationMs,
      exitCode,
    };
  }

  const matches = normalizeOutput(actualClean) === normalizeOutput(test.expectedStdout);

  return {
    testId: test.id,
    verdict: matches ? 'accepted' : 'wrong_answer',
    actualStdout: actualClean,
    durationMs,
    exitCode,
  };
}
