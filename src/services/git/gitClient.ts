import git from 'isomorphic-git';
import type { FileItem } from '../../types/editor';

export interface GitCommitInfo {
  oid: string;
  message: string;
  timestamp: number;
  author: {
    name: string;
    email: string;
  };
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'unmodified';
}

/**
 * Sistema de arquivos em memória compatível com o contrato estrito de isomorphic-git
 */
class GitMemoryFs {
  private tree = new Map<string, Uint8Array>();

  private normalize(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
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
  };

  public unlink = async (path: string): Promise<void> => {
    const norm = this.normalize(path);
    this.tree.delete(norm);
  };

  public readdir = async (path: string): Promise<string[]> => {
    const norm = this.normalize(path).replace(/\/$/, '') + '/';
    const results = new Set<string>();

    for (const key of this.tree.keys()) {
      if (key.startsWith(norm)) {
        const sub = key.slice(norm.length);
        const firstPart = sub.split('/')[0];
        if (firstPart) results.add(firstPart);
      }
    }
    return Array.from(results);
  };

  public mkdir = async (_path: string): Promise<void> => {
    // Mapa plano de memória dispensa nós de diretório explícitos
  };

  public rmdir = async (path: string): Promise<void> => {
    const norm = this.normalize(path).replace(/\/$/, '') + '/';
    for (const key of this.tree.keys()) {
      if (key.startsWith(norm)) {
        this.tree.delete(key);
      }
    }
  };

  public stat = async (path: string) => {
    const norm = this.normalize(path);
    const now = Date.now();

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

    const dirPrefix = norm.replace(/\/$/, '') + '/';
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

export class GitClient {
  private fs = new GitMemoryFs();
  private dir = '/workspace';
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await git.init({ fs: this.fs, dir: this.dir });
      this.isInitialized = true;
    } catch {
      this.isInitialized = true;
    }
  }

  public async syncWorkspace(files: FileItem[]): Promise<GitFileStatus[]> {
    await this.init();

    for (const f of files) {
      if (f.isFolder || f.content === undefined) continue;
      const cleanPath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      await this.fs.writeFile(`${this.dir}/${cleanPath}`, f.content);
    }

    const statuses: GitFileStatus[] = [];
    for (const f of files) {
      if (f.isFolder || f.content === undefined) continue;
      const filepath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      try {
        const status = await git.status({
          fs: this.fs,
          dir: this.dir,
          filepath,
        });

        const s = status as string;
        if (s === 'modified' || s === '*modified') {
          statuses.push({ path: f.path, status: 'modified' });
        } else if (s === 'untracked' || s === 'added' || s === '*added') {
          statuses.push({ path: f.path, status: 'added' });
        } else if (s === 'deleted' || s === '*deleted') {
          statuses.push({ path: f.path, status: 'deleted' });
        } else {
          statuses.push({ path: f.path, status: 'unmodified' });
        }
      } catch {
        statuses.push({ path: f.path, status: 'unmodified' });
      }
    }

    return statuses;
  }

  public async commit(
    files: FileItem[],
    message: string,
    author = { name: 'TheProg Developer', email: 'dev@theprog.local' }
  ): Promise<string> {
    await this.init();

    for (const f of files) {
      if (f.isFolder || f.content === undefined) continue;
      const cleanPath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      await this.fs.writeFile(`${this.dir}/${cleanPath}`, f.content);
      await git.add({ fs: this.fs, dir: this.dir, filepath: cleanPath });
    }

    const sha = await git.commit({
      fs: this.fs,
      dir: this.dir,
      message,
      author,
    });

    return sha;
  }

  public async log(): Promise<GitCommitInfo[]> {
    await this.init();
    try {
      const commits = await git.log({ fs: this.fs, dir: this.dir, depth: 20 });
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
    try {
      const cleanPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
      const oid = commitRef.length === 40 ? commitRef : await git.resolveRef({ fs: this.fs, dir: this.dir, ref: commitRef });
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
}

export const gitClient = new GitClient();
