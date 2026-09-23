import { describe, it, expect } from 'vitest';
import { parseBuildConfig, serializeBuildConfig, resolveSources, PROJECT_CONFIG_PATH } from './buildConfig';

describe('buildConfig', () => {
  it('faz parse e serialização de configuração de build válida', () => {
    const raw = JSON.stringify({
      compiler: 'clang++',
      entry: 'main.cpp',
      sources: ['main.cpp', 'utils.cpp'],
      flags: ['-O2', '-Wall'],
    });

    const parsed = parseBuildConfig(raw);
    expect(parsed).toEqual({
      compiler: 'clang++',
      entry: 'main.cpp',
      sources: ['main.cpp', 'utils.cpp'],
      flags: ['-O2', '-Wall'],
    });

    const serialized = serializeBuildConfig(parsed!);
    expect(parseBuildConfig(serialized)).toEqual(parsed);
  });

  it('retorna null para JSON inválido ou corrompido', () => {
    expect(parseBuildConfig('{')).toBeNull();
    expect(parseBuildConfig('null')).toBeNull();
  });

  it('prioriza sources definidos em .theprog/project.json', () => {
    const files = new Map<string, string>([
      ['main.c', 'int main() {}'],
      ['ignored.c', 'void test() {}'],
      ['used.c', 'void util() {}'],
      [
        PROJECT_CONFIG_PATH,
        JSON.stringify({
          compiler: 'clang',
          sources: ['main.c', 'used.c'],
          flags: ['-O3'],
        }),
      ],
    ]);

    const result = resolveSources(files, 'main.c');
    expect(result.sources).toEqual(['main.c', 'used.c']);
    expect(result.customFlags).toEqual(['-O3']);
    expect(result.customCompiler).toBe('clang');
  });

  it('usa fallback automático se o arquivo de projeto não existir', () => {
    const files = new Map<string, string>([
      ['main.c', 'int main() {}'],
      ['helper.c', 'void helper() {}'],
    ]);

    const result = resolveSources(files, 'main.c');
    expect(result.sources).toEqual(['main.c', 'helper.c']);
  });
});
