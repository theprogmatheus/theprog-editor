import { describe, it, expect } from 'vitest';
import { MemoryVFile, VirtualFileSystem } from './vfs';

describe('VirtualFileSystem & VFile', () => {
  it('cria e manipula VFile de texto com conversão transparente de buffer', async () => {
    const file = new MemoryVFile('f-1', '/src/main.c', 'int main() { return 0; }');
    expect(file.size).toBeGreaterThan(0);
    expect(await file.readText()).toBe('int main() { return 0; }');

    const bytes = await file.readBytes();
    expect(bytes instanceof Uint8Array).toBe(true);

    await file.write('int main() { return 42; }');
    expect(await file.readText()).toBe('int main() { return 42; }');
  });

  it('lê conteúdo via stream em chunks sem carregar tudo em bloco', async () => {
    const raw = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const file = new MemoryVFile('f-bin', '/data.bin', raw, 'binary');

    const stream = file.readStream(3);
    const reader = stream.getReader();

    const chunk1 = await reader.read();
    expect(chunk1.done).toBe(false);
    expect(Array.from(chunk1.value!)).toEqual([1, 2, 3]);

    const chunk2 = await reader.read();
    expect(chunk2.done).toBe(false);
    expect(Array.from(chunk2.value!)).toEqual([4, 5, 6]);

    const chunk3 = await reader.read();
    expect(chunk3.done).toBe(false);
    expect(Array.from(chunk3.value!)).toEqual([7, 8]);

    const chunk4 = await reader.read();
    expect(chunk4.done).toBe(true);
  });

  it('gerencia arquivos registrados no VirtualFileSystem', () => {
    const vfs = new VirtualFileSystem();
    const f1 = new MemoryVFile('1', '/a.txt', 'hello');
    const f2 = new MemoryVFile('2', '/b.txt', 'world');

    vfs.register(f1);
    vfs.register(f2);

    expect(vfs.get('/a.txt')).toBe(f1);
    expect(vfs.list()).toHaveLength(2);

    vfs.remove('/a.txt');
    expect(vfs.get('/a.txt')).toBeUndefined();
    expect(vfs.list()).toHaveLength(1);
  });
});
