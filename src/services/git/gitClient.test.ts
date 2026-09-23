import { describe, it, expect } from 'vitest';
import { GitClient } from './gitClient';
import type { FileItem } from '../../types/editor';

describe('GitClient (isomorphic-git local)', () => {
  const makeFiles = (content: string, path = '/main.c'): FileItem[] => [
    {
      id: 'f-1',
      name: path.split('/').pop() || 'file',
      path,
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

  it('detecta arquivos modificados e calcula status com separação staged/unstaged', async () => {
    const client = new GitClient();
    await client.init();
    await client.commit(makeFiles('versao 1'), 'V1');

    // Modifica o arquivo no working tree
    const statusBefore = await client.getStatus(makeFiles('versao 2 alterada'));
    expect(statusBefore.unstaged.length).toBe(1);
    expect(statusBefore.unstaged[0].path).toBe('/main.c');
    expect(statusBefore.unstaged[0].status).toBe('modified');
    expect(statusBefore.staged.length).toBe(0);

    // Faz stage do arquivo
    await client.stage('/main.c');
    const statusAfterStage = await client.getStatus(makeFiles('versao 2 alterada'));
    expect(statusAfterStage.staged.length).toBe(1);
    expect(statusAfterStage.staged[0].path).toBe('/main.c');
    expect(statusAfterStage.staged[0].stage).toBe('staged');

    // Faz unstage do arquivo
    await client.unstage('/main.c');
    const statusAfterUnstage = await client.getStatus(makeFiles('versao 2 alterada'));
    expect(statusAfterUnstage.staged.length).toBe(0);
    expect(statusAfterUnstage.unstaged.length).toBe(1);
  });

  it('descarta alterações restaurando versão do commit HEAD', async () => {
    const client = new GitClient();
    await client.init();
    await client.commit(makeFiles('conteudo estavel'), 'Commit Base');

    // Simula alteração
    await client.getStatus(makeFiles('conteudo corrompido'));
    const restored = await client.discard('/main.c');
    expect(restored).toBe('conteudo estavel');
  });

  it('permite criar e alternar branches locais', async () => {
    const client = new GitClient();
    await client.init('main');
    await client.commit(makeFiles('versao main'), 'Commit no main');

    // Cria branch feature
    await client.createBranch('feature-1');
    const branches = await client.listBranches();
    expect(branches.some((b) => b.name === 'feature-1')).toBe(true);

    // Alterna para branch feature
    const files = await client.checkout('feature-1');
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files[0].path).toBe('/main.c');
  });
});
