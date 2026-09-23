export interface Breakpoint {
  line: number;
  filePath: string;
  verified?: boolean;
}

export interface DebugVariable {
  name: string;
  value: string;
  type: string;
}

export interface DebugFrame {
  line: number;
  functionName: string;
  filePath: string;
  variables: DebugVariable[];
}

export interface DebuggerState {
  isDebugging: boolean;
  isPaused: boolean;
  currentFrame?: DebugFrame;
  breakpoints: Breakpoint[];
}
