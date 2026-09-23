import type { Breakpoint, DebugFrame, DebuggerState } from './debuggerTypes';

export class DebuggerManager {
  private breakpoints: Breakpoint[] = [];
  private state: DebuggerState = {
    isDebugging: false,
    isPaused: false,
    breakpoints: [],
  };
  private listeners = new Set<(state: DebuggerState) => void>();

  public subscribe(listener: (state: DebuggerState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.state = {
      ...this.state,
      breakpoints: [...this.breakpoints],
    };
    this.listeners.forEach((l) => l(this.state));
  }

  public getBreakpoints(filePath?: string): Breakpoint[] {
    if (!filePath) return [...this.breakpoints];
    const clean = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return this.breakpoints.filter((b) => b.filePath === clean || b.filePath === filePath);
  }

  public toggleBreakpoint(filePath: string, line: number): void {
    const clean = filePath.startsWith('/') ? filePath : `/${filePath}`;
    const idx = this.breakpoints.findIndex((b) => (b.filePath === clean || b.filePath === filePath) && b.line === line);

    if (idx >= 0) {
      this.breakpoints.splice(idx, 1);
    } else {
      this.breakpoints.push({ filePath: clean, line, verified: true });
    }
    this.notify();
  }

  public clearBreakpoints(filePath?: string): void {
    if (filePath) {
      const clean = filePath.startsWith('/') ? filePath : `/${filePath}`;
      this.breakpoints = this.breakpoints.filter((b) => b.filePath !== clean && b.filePath !== filePath);
    } else {
      this.breakpoints = [];
    }
    this.notify();
  }

  public setPaused(frame: DebugFrame): void {
    this.state = {
      ...this.state,
      isDebugging: true,
      isPaused: true,
      currentFrame: frame,
    };
    this.notify();
  }

  public resume(): void {
    this.state = {
      ...this.state,
      isPaused: false,
      currentFrame: undefined,
    };
    this.notify();
  }

  public stop(): void {
    this.state = {
      ...this.state,
      isDebugging: false,
      isPaused: false,
      currentFrame: undefined,
    };
    this.notify();
  }
}

export const debuggerManager = new DebuggerManager();
