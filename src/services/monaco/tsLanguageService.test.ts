import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Teste de regressão para a configuração do worker TypeScript do Monaco.
 *
 * Contexto: `setCompilerOptions` SUBSTITUI os defaults do Monaco. Sem
 * `allowNonTsExtensions: true`, o `lib.dom.d.ts` não é resolvido quando `lib`
 * é especificado explicitamente, fazendo `console` deixar de existir
 * (erro TS2584). Também não devemos definir `lib` para usar o default
 * `lib.es<target>.full.d.ts`, que já inclui DOM e DOM.Iterable.
 */
describe('tsLanguageService: opções do compilador TypeScript', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./tsLanguageService.ts', import.meta.url)),
    'utf8'
  );

  it('define allowNonTsExtensions: true', () => {
    expect(source).toContain('allowNonTsExtensions: true');
  });

  it('não define "lib" explicitamente', () => {
    expect(source).not.toMatch(/\blib:\s*\[/);
  });
});
