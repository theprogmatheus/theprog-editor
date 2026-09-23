import { describe, it, expect } from 'vitest';
import { DebuggerManager } from './debuggerManager';

describe('DebuggerManager', () => {
  it('adiciona e alterna breakpoints em arquivos', () => {
    const mgr = new DebuggerManager();
    expect(mgr.getBreakpoints('/main.py')).toHaveLength(0);

    mgr.toggleBreakpoint('/main.py', 10);
    expect(mgr.getBreakpoints('/main.py')).toHaveLength(1);
    expect(mgr.getBreakpoints('/main.py')[0].line).toBe(10);

    // Alternar novamente remove
    mgr.toggleBreakpoint('/main.py', 10);
    expect(mgr.getBreakpoints('/main.py')).toHaveLength(0);
  });

  it('gerencia estado de pausa e retomada de execução', () => {
    const mgr = new DebuggerManager();

    mgr.setPaused({
      line: 15,
      functionName: 'calcular',
      filePath: '/main.py',
      variables: [{ name: 'x', value: '42', type: 'int' }],
    });

    let lastState: any;
    mgr.subscribe((st) => {
      lastState = st;
    });

    expect(lastState.isPaused).toBe(true);
    expect(lastState.currentFrame?.functionName).toBe('calcular');

    mgr.resume();
    expect(lastState.isPaused).toBe(false);
    expect(lastState.currentFrame).toBeUndefined();
  });
});
