import { describe, expect, it } from 'vitest';
import type { FileItem } from '../../types/editor';
import type { RuntimeProgressMap } from '../runtimes/types';
import { getRunCapability } from './runCapability';

function makeFile(overrides: Partial<FileItem>): FileItem {
  return {
    id: 'f-1',
    name: 'main.c',
    path: '/main.c',
    isFolder: false,
    parentId: null,
    language: 'c',
    updatedAt: 0,
    content: 'int main() { return 0; }',
    ...overrides,
  };
}

const ready = { status: 'ready' as const, percent: 100, doneBytes: 10, totalBytes: 10 };

function makeRuntimes(overrides: RuntimeProgressMap = {}): RuntimeProgressMap {
  return {
    clang: ready,
    python: ready,
    js: ready,
    ...overrides,
  };
}

describe('getRunCapability', () => {
  it('C com main() e Clang pronto pode compilar e executar', () => {
    const capability = getRunCapability(makeFile({}), makeRuntimes());
    expect(capability.canRun).toBe(true);
    expect(capability.label).toBe('Compilar & Executar');
  });

  it('C sem main() fica indisponível com motivo explicativo', () => {
    const capability = getRunCapability(
      makeFile({ content: 'void helper(void) {}' }),
      makeRuntimes()
    );
    expect(capability.canRun).toBe(false);
    expect(capability.reason).toContain('main()');
  });

  it('C com Clang carregando fica indisponível', () => {
    const capability = getRunCapability(
      makeFile({}),
      makeRuntimes({
        clang: { status: 'loading', percent: 42, doneBytes: 4, totalBytes: 10 },
      })
    );
    expect(capability.canRun).toBe(false);
    expect(capability.reason).toContain('42%');
  });

  it('cabeçalhos nunca executam', () => {
    const capability = getRunCapability(makeFile({ name: 'utils.h', language: 'h' }), makeRuntimes());
    expect(capability.canRun).toBe(false);
    expect(capability.reason).toContain('cabeçalho');
  });

  it('Python executa quando o runtime está pronto', () => {
    const capability = getRunCapability(
      makeFile({ name: 'app.py', language: 'python' }),
      makeRuntimes()
    );
    expect(capability.canRun).toBe(true);
    expect(capability.label).toBe('Executar');
  });

  it('Python fica indisponível enquanto carrega', () => {
    const capability = getRunCapability(
      makeFile({ name: 'app.py', language: 'python' }),
      makeRuntimes({ python: { status: 'unloaded', percent: 0, doneBytes: 0, totalBytes: 0 } })
    );
    expect(capability.canRun).toBe(false);
    expect(capability.reason).toContain('não foi inicializado');
  });

  it('JavaScript e TypeScript executam quando o runtime está pronto', () => {
    expect(
      getRunCapability(makeFile({ name: 'index.js', language: 'javascript' }), makeRuntimes()).canRun
    ).toBe(true);
    expect(
      getRunCapability(makeFile({ name: 'main.ts', language: 'typescript' }), makeRuntimes()).canRun
    ).toBe(true);
  });

  it('binários exibem mensagem de visualização não suportada', () => {
    const capability = getRunCapability(makeFile({ kind: 'binary', language: 'plaintext' }), makeRuntimes());
    expect(capability.canRun).toBe(false);
    expect(capability.reason).toBe('Visualização não suportada');
  });

  it('Markdown não executa nesta versão', () => {
    const capability = getRunCapability(
      makeFile({ name: 'README.md', language: 'markdown' }),
      makeRuntimes()
    );
    expect(capability.canRun).toBe(false);
    expect(capability.reason).toContain('Markdown');
  });

  it('nenhum arquivo aberto fica indisponível', () => {
    const capability = getRunCapability(null, makeRuntimes());
    expect(capability.canRun).toBe(false);
    expect(capability.reason).toContain('Nenhum arquivo');
  });
});
