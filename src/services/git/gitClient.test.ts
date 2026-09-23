import { describe, it, expect } from 'vitest';
import { GitClient } from './gitClient';
import type { FileItem } from '../../types/editor';

describe('GitClient (isomorphic-git local)', () => {
  const makeFiles = (content: string): FileItem[] => [
    {
      id: 'f-1',
      name: 'main.c',
      path: '/main.c',
      isFolder: false,
      parentId: null,
      language: 'c',
      updatedAt: Date.now(),
      content,
    },
  ];

  it('inicializa repositório e realiza commit com histórico acessível', async () => {
    const client = new GitClient();
    await client.init();

    const sha = await client.commit(makeFiles('int main() { return 0; }'), 'Commit inicial');
    expect(typeof sha).toBe('string');
    expect(sha.length).toBe(40);

    const history = await client.log();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].message.trim()).toBe('Commit inicial');

    const content = await client.readAtCommit('main.c');
    expect(content).toBe('int main() { return 0; }');
  });

  it('detecta arquivos modificados e calcula status', async () => {
    const client = new GitClient();
    await client.init();
    await client.commit(makeFiles('versao 1'), 'V1');

    const statuses = await client.syncWorkspace(makeFiles('versao 2 alterada'));
    const fileStatus = statuses.find((s) => s.path === '/main.c');
    expect(fileStatus?.status).toBe('modified');
  });
});
