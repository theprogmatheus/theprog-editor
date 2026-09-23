import git from 'isomorphic-git';
import type { GitStatusEntry, GitCommitInfo, GitAuthor, GitBranchInfo } from '../../types/editor';

/**
 * Sistema de arquivos em memória com suporte a persistência assíncrona no IndexedDB
 * compatível com o contrato de filesystem do isomorphic-git.
 */
export class GitIdbFs {
  private tree = new Map<string, Uint8Array>();
  private idbName = 'theprog-editor-db';
  private idbVersion = 4;
  private storeName = 'git_fs';
  private isHydrated = false;

  private normalize(path: string): string {
    const raw = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    const segments = raw.split('/').filter((s) => s && s !== '.');
    return segments.join('/');
  }

  /**
   * Hidrata os objetos do .git a partir do IndexedDB se disponível
   */
  public async initStorage(): Promise<void> {
    if (this.isHydrated) return;
    this.isHydrated = true;

    if (typeof indexedDB === 'undefined') {
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.open(this.idbName, this.idbVersion);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        req.onsuccess = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            resolve();
            return;
          }
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = (ev: any) => {
            const cursor = ev.target.result;
            if (cursor) {
              this.tree.set(cursor.key as string, cursor.value as Uint8Array);
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorReq.onerror = () => resolve();
        };
        req.onerror = () => resolve();
      });
    } catch {
      // Fallback gracioso para memória
    }
  }

  private async persistToIdb(key: string, data: Uint8Array | null): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    try {
      const req = indexedDB.open(this.idbName, this.idbVersion);
      req.onsuccess = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) return;
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        if (data === null) {
          store.delete(key);
        } else {
          store.put(data, key);
        }
      };
    } catch {
      // Ignora falhas de persistência assíncronas em background
    }
  }

  public readFile = async (
    path: string,
    options?: { encoding?: string } | string
  ): Promise<Uint8Array | string> => {
    const norm = this.normalize(path);
    const data = this.tree.get(norm);
    if (!data) {
      const err: any = new Error(`ENOENT: no such file or directory, open '${path}'`);
      err.code = 'ENOENT';
      throw err;
    }
    const encoding = typeof options === 'string' ? options : options?.encoding;
    if (encoding === 'utf8' || encoding === 'utf-8') {
      return new TextDecoder().decode(data);
    }
    return data;
  };

  public writeFile = async (path: string, data: Uint8Array | string): Promise<void> => {
    const norm = this.normalize(path);
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.tree.set(norm, bytes);

    // Persiste no IndexedDB se for arquivo dentro de .git
    if (norm.includes('.git/')) {
      await this.persistToIdb(norm, bytes);
    }
  };

  public unlink = async (path: string): Promise<void> => {
    const norm = this.normalize(path);
    this.tree.delete(norm);
    if (norm.includes('.git/')) {
      await this.persistToIdb(norm, null);
    }
  };

  public readdir = async (path: string): Promise<string[]> => {
    const norm = this.normalize(path);
    const dirPrefix = norm ? `${norm}/` : '';
    const results = new Set<string>();

    for (const key of this.tree.keys()) {
      if (dirPrefix === '' || key.startsWith(dirPrefix)) {
        const sub = dirPrefix === '' ? key : key.slice(dirPrefix.length);
        const firstPart = sub.split('/')[0];
        if (firstPart) results.add(firstPart);
      }
    }
    return Array.from(results);
  };

  public mkdir = async (_path: string): Promise<void> => {
    // Mapa plano não exige nós de diretório explícitos
  };

  public rmdir = async (path: string): Promise<void> => {
    const norm = this.normalize(path);
    const dirPrefix = norm ? `${norm}/` : '';
    for (const key of Array.from(this.tree.keys())) {
      if (dirPrefix === '' || key.startsWith(dirPrefix)) {
        this.tree.delete(key);
        if (key.includes('.git/')) {
          await this.persistToIdb(key, null);
        }
      }
    }
  };

  public stat = async (path: string) => {
    const norm = this.normalize(path);
    const now = Date.now();

    if (norm === '' || norm === 'workspace') {
      return {
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
        size: 0,
        mtimeMs: now,
        ctimeMs: now,
        ino: 1,
        mode: 0o040755,
        uid: 1,
        gid: 1,
        dev: 1,
      };
    }

    if (this.tree.has(norm)) {
      const size = this.tree.get(norm)!.byteLength;
      return {
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        size,
        mtimeMs: now,
        ctimeMs: now,
        ino: 1,
        mode: 0o100644,
        uid: 1,
        gid: 1,
        dev: 1,
      };
    }

    const dirPrefix = norm ? `${norm}/` : '';
    for (const key of this.tree.keys()) {
      if (key.startsWith(dirPrefix)) {
        return {
          isFile: () => false,
          isDirectory: () => true,
          isSymbolicLink: () => false,
          size: 0,
          mtimeMs: now,
          ctimeMs: now,
          ino: 1,
          mode: 0o040755,
          uid: 1,
          gid: 1,
          dev: 1,
        };
      }
    }

    const err: any = new Error(`ENOENT: no such file or directory, stat '${path}'`);
    err.code = 'ENOENT';
    throw err;
  };

  public lstat = async (path: string) => {
    return this.stat(path);
  };

  public readlink = async (_path: string): Promise<string> => {
    const err: any = new Error('ENOSYS: function not implemented');
    err.code = 'ENOSYS';
    throw err;
  };

  public symlink = async (_target: string, _path: string): Promise<void> => {
    const err: any = new Error('ENOSYS: function not implemented');
    err.code = 'ENOSYS';
    throw err;
  };

  public promises = this;
}

export interface WorkspaceFileInput {
  path: string;
  content?: string;
}

export interface GitStatusResult {
  isInitialized: boolean;
  currentBranch: string;
  staged: GitStatusEntry[];
  unstaged: GitStatusEntry[];
  headCommitSha?: string;
}

/**
 * Motor central de operações Git locais construído sobre isomorphic-git.
 */
export class GitEngine {
  private fs: GitIdbFs;
  private dir = '/workspace';
  private defaultAuthor: GitAuthor = {
    name: 'TheProg Developer',
    email: 'dev@theprog.local',
  };

  constructor(customFs?: GitIdbFs) {
    this.fs = customFs || new GitIdbFs();
  }

  public async initStorage(): Promise<void> {
    await this.fs.initStorage();
  }

  public async isInitialized(): Promise<boolean> {
    await this.fs.initStorage();
    try {
      await this.fs.stat(`${this.dir}/.git/HEAD`);
      return true;
    } catch {
      return false;
    }
  }

  public async init(defaultBranch = 'main'): Promise<void> {
    await this.fs.initStorage();
    await git.init({
      fs: this.fs,
      dir: this.dir,
      defaultBranch,
    });
  }

  public async syncFiles(files: WorkspaceFileInput[]): Promise<void> {
    await this.fs.initStorage();
    const activePaths = new Set<string>();

    for (const f of files) {
      if (f.content === undefined) continue;
      const cleanPath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      activePaths.add(cleanPath);
      await this.fs.writeFile(`${this.dir}/${cleanPath}`, f.content);
    }

    // Remove arquivos do working tree do FS virtual que foram excluídos do workspace
    try {
      const tracked = await git.listFiles({ fs: this.fs, dir: this.dir });
      for (const t of tracked) {
        if (!activePaths.has(t)) {
          try {
            await this.fs.unlink(`${this.dir}/${t}`);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Repositório pode não ter commits ainda
    }
  }

  public async getStatus(files: WorkspaceFileInput[]): Promise<GitStatusResult> {
    const initialized = await this.isInitialized();
    if (!initialized) {
      return {
        isInitialized: false,
        currentBranch: 'main',
        staged: [],
        unstaged: [],
      };
    }

    await this.syncFiles(files);

    let currentBranch = 'main';
    try {
      const b = await git.currentBranch({ fs: this.fs, dir: this.dir, fullname: false });
      if (b) currentBranch = b;
    } catch {
      // fallback
    }

    let headCommitSha: string | undefined;
    try {
      headCommitSha = await git.resolveRef({ fs: this.fs, dir: this.dir, ref: 'HEAD' });
    } catch {
      // HEAD pode não apontar para nada se ainda não houver commits
    }

    // Coleta todos os caminhos conhecidos: arquivos atuais + arquivos no índice/HEAD
    const allPaths = new Set<string>();
    for (const f of files) {
      if (f.content !== undefined) {
        allPaths.add(f.path.startsWith('/') ? f.path.slice(1) : f.path);
      }
    }

    try {
      const tracked = await git.listFiles({ fs: this.fs, dir: this.dir });
      for (const t of tracked) {
        allPaths.add(t);
      }
    } catch {
      // ignore
    }

    const staged: GitStatusEntry[] = [];
    const unstaged: GitStatusEntry[] = [];

    for (const filepath of allPaths) {
      try {
        const s = (await git.status({
          fs: this.fs,
          dir: this.dir,
          filepath,
        })) as string;

        const originalPath = filepath.startsWith('/') ? filepath : `/${filepath}`;

        if (s === 'modified') {
          staged.push({ path: originalPath, status: 'modified', stage: 'staged' });
        } else if (s === '*modified') {
          unstaged.push({ path: originalPath, status: 'modified', stage: 'unstaged' });
        } else if (s === 'added') {
          staged.push({ path: originalPath, status: 'added', stage: 'staged' });
        } else if (s === '*added') {
          unstaged.push({ path: originalPath, status: 'added', stage: 'untracked' });
        } else if (s === 'deleted') {
          staged.push({ path: originalPath, status: 'deleted', stage: 'staged' });
        } else if (s === '*deleted') {
          unstaged.push({ path: originalPath, status: 'deleted', stage: 'unstaged' });
        }
      } catch {
        // Arquivo ignorado ou com erro de status
      }
    }

    return {
      isInitialized: true,
      currentBranch,
      staged,
      unstaged,
      headCommitSha,
    };
  }

  public async stage(filepath: string): Promise<void> {
    const cleanPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
    try {
      await this.fs.stat(`${this.dir}/${cleanPath}`);
      await git.add({ fs: this.fs, dir: this.dir, filepath: cleanPath });
    } catch {
      // Se não existe no working tree, remove do índice
      await git.remove({ fs: this.fs, dir: this.dir, filepath: cleanPath });
    }
  }

  public async stageAll(files: WorkspaceFileInput[]): Promise<void> {
    await this.syncFiles(files);
    const status = await this.getStatus(files);
    for (const item of status.unstaged) {
      await this.stage(item.path);
    }
  }

  public async unstage(filepath: string): Promise<void> {
    const cleanPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
    await git.resetIndex({ fs: this.fs, dir: this.dir, filepath: cleanPath });
  }

  public async unstageAll(): Promise<void> {
    const tracked = await git.listFiles({ fs: this.fs, dir: this.dir });
    for (const filepath of tracked) {
      await git.resetIndex({ fs: this.fs, dir: this.dir, filepath });
    }
  }

  public async discard(filepath: string): Promise<string | null> {
    const cleanPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
    const content = await this.readAtCommit(cleanPath, 'HEAD');
    if (content !== null) {
      await this.fs.writeFile(`${this.dir}/${cleanPath}`, content);
    } else {
      try {
        await this.fs.unlink(`${this.dir}/${cleanPath}`);
      } catch {
        // ignore
      }
    }
    return content;
  }

  public async commit(message: string, author?: GitAuthor): Promise<string> {
    const authorData = author || this.defaultAuthor;
    const sha = await git.commit({
      fs: this.fs,
      dir: this.dir,
      message,
      author: authorData,
    });
    return sha;
  }

  public async log(depth = 30): Promise<GitCommitInfo[]> {
    const initialized = await this.isInitialized();
    if (!initialized) return [];

    try {
      const commits = await git.log({ fs: this.fs, dir: this.dir, depth });
      return commits.map((c) => ({
        oid: c.oid,
        message: c.commit.message,
        timestamp: c.commit.author.timestamp * 1000,
        author: {
          name: c.commit.author.name,
          email: c.commit.author.email,
        },
      }));
    } catch {
      return [];
    }
  }

  public async readAtCommit(filepath: string, commitRef = 'HEAD'): Promise<string | null> {
    const initialized = await this.isInitialized();
    if (!initialized) return null;

    try {
      const cleanPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
      const oid =
        commitRef.length === 40
          ? commitRef
          : await git.resolveRef({ fs: this.fs, dir: this.dir, ref: commitRef });

      const { blob } = await git.readBlob({
        fs: this.fs,
        dir: this.dir,
        oid,
        filepath: cleanPath,
      });
      return new TextDecoder().decode(blob);
    } catch {
      return null;
    }
  }

  public async listBranches(): Promise<GitBranchInfo[]> {
    const initialized = await this.isInitialized();
    if (!initialized) return [];

    try {
      const branches = await git.listBranches({ fs: this.fs, dir: this.dir });
      const current = await git.currentBranch({ fs: this.fs, dir: this.dir, fullname: false });
      return branches.map((name) => ({
        name,
        isCurrent: name === current,
      }));
    } catch {
      return [{ name: 'main', isCurrent: true }];
    }
  }

  public async createBranch(name: string): Promise<void> {
    await git.branch({ fs: this.fs, dir: this.dir, ref: name });
  }

  public async checkout(branchName: string): Promise<Array<{ path: string; content: string }>> {
    await git.checkout({ fs: this.fs, dir: this.dir, ref: branchName });
    const tracked = await git.listFiles({ fs: this.fs, dir: this.dir });
    const files: Array<{ path: string; content: string }> = [];

    for (const t of tracked) {
      try {
        const data = await this.fs.readFile(`${this.dir}/${t}`, 'utf8');
        files.push({ path: `/${t}`, content: data as string });
      } catch {
        // ignore
      }
    }
    return files;
  }
}
