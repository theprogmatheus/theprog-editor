export type LanguageId =
  | 'c'
  | 'cpp'
  | 'h'
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'markdown'
  | 'plaintext';

export type FileKind = 'text' | 'binary' | 'image' | 'too_large';

export type RuntimeId = 'clang' | 'python' | 'js';

export interface RunCapability {
  canRun: boolean;
  action: 'compile-run' | 'run' | 'none';
  label: string;
  reason?: string;
}

export interface RunPlan {
  runtime: RuntimeId;
  language: LanguageId;
  entryFile: string;
  files: Map<string, string>;
  args?: string[];
  statusMessage: string;
}
