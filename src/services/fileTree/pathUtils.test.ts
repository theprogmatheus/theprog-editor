import { describe, it, expect } from 'vitest';
import {
  splitPathSegments,
  isPathValidForCreation,
  getBaseName,
  getDirName,
} from './pathUtils';

describe('pathUtils', () => {
  describe('splitPathSegments', () => {
    it('divide caminhos simples e complexos com barras normais e invertidas', () => {
      expect(splitPathSegments('src/components/Button.tsx')).toEqual(['src', 'components', 'Button.tsx']);
      expect(splitPathSegments('src\\views\\Home.vue')).toEqual(['src', 'views', 'Home.vue']);
      expect(splitPathSegments('/root/child/')).toEqual(['root', 'child']);
      expect(splitPathSegments('  //a///b//c/ ')).toEqual(['a', 'b', 'c']);
    });

    it('retorna array vazio para strings vazias', () => {
      expect(splitPathSegments('')).toEqual([]);
      expect(splitPathSegments('   ///   ')).toEqual([]);
    });
  });

  describe('isPathValidForCreation', () => {
    it('aceita caminhos válidos simples e aninhados', () => {
      expect(isPathValidForCreation('main.c')).toBe(true);
      expect(isPathValidForCreation('src/main.c')).toBe(true);
      expect(isPathValidForCreation('src/components/Button.tsx')).toBe(true);
      expect(isPathValidForCreation('.gitignore')).toBe(true);
      expect(isPathValidForCreation('.theprog/project.json')).toBe(true);
    });

    it('rejeita caminhos com caracteres proibidos ou sequências inválidas', () => {
      expect(isPathValidForCreation('')).toBe(false);
      expect(isPathValidForCreation('.')).toBe(false);
      expect(isPathValidForCreation('..')).toBe(false);
      expect(isPathValidForCreation('src/../main.c')).toBe(false);
      expect(isPathValidForCreation('src//main.c')).toBe(false);
      expect(isPathValidForCreation('file?.txt')).toBe(false);
      expect(isPathValidForCreation('file*.txt')).toBe(false);
      expect(isPathValidForCreation('dir<test>/a.c')).toBe(false);
      expect(isPathValidForCreation('bad"name.c')).toBe(false);
      expect(isPathValidForCreation('bad:name.c')).toBe(false);
    });
  });

  describe('getBaseName e getDirName', () => {
    it('extrai corretamente o nome base e o diretório', () => {
      expect(getBaseName('/src/components/Button.tsx')).toBe('Button.tsx');
      expect(getBaseName('main.c')).toBe('main.c');
      expect(getDirName('/src/components/Button.tsx')).toBe('/src/components');
      expect(getDirName('/main.c')).toBe('');
      expect(getDirName('main.c')).toBe('');
    });
  });
});
