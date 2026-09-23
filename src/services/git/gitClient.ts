import type { FileItem, GitStatusEntry, GitCommitInfo, GitAuthor, GitBranchInfo } from '../../types/editor';
import { GitEngine, type GitStatusResult } from './gitEngine';

export type { GitStatusResult, GitCommitInfo, GitBranchInfo, GitStatusEntry };
export type GitFileStatus = GitStatusEntry;

export class GitClient {
  private worker: Worker | null = null;
  private engineFallback: GitEngine | null = null;
  private pendingRequests = new Map<
    number,
    { resolve: (data: any) => void; reject: (err: any) => void }
  >();
  private nextId = 1;

  private getEngine(): GitEngine {
    if (!this.engineFallback) {
      this.engineFallback = new GitEngine();
    }
    return this.engineFallback;
  }

  private ensureWorker(): Worker | null {
    if (typeof Worker === 'undefined' || typeof window === 'undefined') {
      return null;
    }

    if (!this.worker) {
      try {
        this.worker = new Worker(new URL('../../workers/gitWorker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (e: MessageEvent) => {
          const { id, success, data, error } = e.data;
          const pending = this.pendingRequests.get(id);
          if (pending) {
            this.pendingRequests.delete(id);
            if (success) {
              pending.resolve(data);
            } else {
              pending.reject(new Error(error || 'Erro desconhecido no GitWorker'));
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('Erro na thread do GitWorker:', err);
        };
      } catch (err) {
        console.warn('Falha ao instanciar GitWorker, utilizando fallback local:', err);
        this.worker = null;
      }
    }
    return this.worker;
  }

  private async sendRequest<T = any>(type: string, payload?: any): Promise<T> {
    const worker = this.ensureWorker();
    if (!worker) {
      const engine = this.getEngine();
      switch (type) {
        case 'IS_INITIALIZED':
          return (await engine.isInitialized()) as T;
        case 'INIT':
          return (await engine.init(payload?.defaultBranch)) as T;
        case 'GET_STATUS':
          return (await engine.getStatus(payload?.files || [])) as T;
        case 'STAGE':
          return (await engine.stage(payload.filepath)) as T;
        case 'STAGE_ALL':
          return (await engine.stageAll(payload?.files || [])) as T;
        case 'UNSTAGE':
          return (await engine.unstage(payload.filepath)) as T;
        case 'UNSTAGE_ALL':
          return (await engine.unstageAll()) as T;
        case 'DISCARD':
          return (await engine.discard(payload.filepath)) as T;
        case 'COMMIT':
          return (await engine.commit(payload.message, payload.author)) as T;
        case 'LOG':
          return (await engine.log(payload?.depth)) as T;
        case 'READ_AT_COMMIT':
          return (await engine.readAtCommit(payload.filepath, payload?.commitRef)) as T;
        case 'LIST_BRANCHES':
          return (await engine.listBranches()) as T;
        case 'CREATE_BRANCH':
          return (await engine.createBranch(payload.name)) as T;
        case 'CHECKOUT':
          return (await engine.checkout(payload.name)) as T;
        default:
          throw new Error(`Comando Git não suportado: ${type}`);
      }
    }

    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
    });
  }

  public async isInitialized(): Promise<boolean> {
    return this.sendRequest<boolean>('IS_INITIALIZED');
  }

  public async init(defaultBranch = 'main'): Promise<void> {
    return this.sendRequest<void>('INIT', { defaultBranch });
  }

  private mapFilesToInputs(files: FileItem[]): Array<{ path: string; content?: string }> {
    return files
      .filter((f) => !f.isFolder && f.content !== undefined)
      .map((f) => ({ path: f.path, content: f.content }));
  }

  public async getStatus(files: FileItem[]): Promise<GitStatusResult> {
    const inputs = this.mapFilesToInputs(files);
    return this.sendRequest<GitStatusResult>('GET_STATUS', { files: inputs });
  }

  public async syncWorkspace(files: FileItem[]): Promise<GitStatusEntry[]> {
    const res = await this.getStatus(files);
    return [...res.staged, ...res.unstaged];
  }

  public async stage(filepath: string): Promise<void> {
    return this.sendRequest<void>('STAGE', { filepath });
  }

  public async stageAll(files: FileItem[]): Promise<void> {
    const inputs = this.mapFilesToInputs(files);
    return this.sendRequest<void>('STAGE_ALL', { files: inputs });
  }

  public async unstage(filepath: string): Promise<void> {
    return this.sendRequest<void>('UNSTAGE', { filepath });
  }

  public async unstageAll(): Promise<void> {
    return this.sendRequest<void>('UNSTAGE_ALL');
  }

  public async discard(filepath: string): Promise<string | null> {
    return this.sendRequest<string | null>('DISCARD', { filepath });
  }

  public async commit(
    filesOrMessage: FileItem[] | string,
    messageOrAuthor?: string | GitAuthor,
    authorArg?: GitAuthor
  ): Promise<string> {
    if (Array.isArray(filesOrMessage)) {
      // Assinatura retrocompatível commit(files, message, author)
      const files = filesOrMessage;
      const message = typeof messageOrAuthor === 'string' ? messageOrAuthor : 'Atualização de arquivos';
      const author = authorArg;
      await this.stageAll(files);
      return this.sendRequest<string>('COMMIT', { message, author });
    }

    const message = filesOrMessage;
    const author = messageOrAuthor as GitAuthor | undefined;
    return this.sendRequest<string>('COMMIT', { message, author });
  }

  public async log(depth = 30): Promise<GitCommitInfo[]> {
    return this.sendRequest<GitCommitInfo[]>('LOG', { depth });
  }

  public async readAtCommit(filepath: string, commitRef = 'HEAD'): Promise<string | null> {
    return this.sendRequest<string | null>('READ_AT_COMMIT', { filepath, commitRef });
  }

  public async listBranches(): Promise<GitBranchInfo[]> {
    return this.sendRequest<GitBranchInfo[]>('LIST_BRANCHES');
  }

  public async createBranch(name: string): Promise<void> {
    return this.sendRequest<void>('CREATE_BRANCH', { name });
  }

  public async checkout(name: string): Promise<Array<{ path: string; content: string }>> {
    return this.sendRequest<Array<{ path: string; content: string }>>('CHECKOUT', { name });
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

export const gitClient = new GitClient();
