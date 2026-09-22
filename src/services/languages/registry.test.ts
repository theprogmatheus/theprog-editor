import { describe, expect, it } from 'vitest';
import {
  detectFileKindByExtension,
  detectFileKindFromBytes,
  detectLanguage,
  getMonacoLanguage,
  getRuntimeForLanguage,
  isLikelyBinaryByName,
  isTextFileKind,
} from './registry';

describe('registry: detecção de linguagem', () => {
  it('mapeia extensões para linguagens suportadas', () => {
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('main.cpp')).toBe('cpp');
    expect(detectLanguage('lib.cc')).toBe('cpp');
    expect(detectLanguage('utils.h')).toBe('h');
    expect(detectLanguage('app.py')).toBe('python');
    expect(detectLanguage('index.js')).toBe('javascript');
    expect(detectLanguage('module.mjs')).toBe('javascript');
    expect(detectLanguage('main.ts')).toBe('typescript');
    expect(detectLanguage('README.md')).toBe('markdown');
    expect(detectLanguage('arquivo.xyz')).toBe('plaintext');
  });

  it('mapeia ids do Monaco', () => {
    expect(getMonacoLanguage('c')).toBe('c');
    expect(getMonacoLanguage('h')).toBe('cpp');
    expect(getMonacoLanguage('python')).toBe('python');
    expect(getMonacoLanguage('javascript')).toBe('javascript');
    expect(getMonacoLanguage('typescript')).toBe('typescript');
    expect(getMonacoLanguage('markdown')).toBe('markdown');
    expect(getMonacoLanguage('plaintext')).toBe('plaintext');
  });

  it('mapeia runtimes de execução', () => {
    expect(getRuntimeForLanguage('c')).toBe('clang');
    expect(getRuntimeForLanguage('cpp')).toBe('clang');
    expect(getRuntimeForLanguage('python')).toBe('python');
    expect(getRuntimeForLanguage('javascript')).toBe('js');
    expect(getRuntimeForLanguage('typescript')).toBe('js');
    expect(getRuntimeForLanguage('h')).toBeNull();
    expect(getRuntimeForLanguage('markdown')).toBeNull();
  });
});

describe('registry: classificação de arquivos', () => {
  it('detecta imagens e binários por extensão', () => {
    expect(detectFileKindByExtension('foto.png')).toBe('image');
    expect(detectFileKindByExtension('video.mp4')).toBe('binary');
    expect(detectFileKindByExtension('programa.exe')).toBe('binary');
    expect(detectFileKindByExtension('main.c')).toBeNull();
  });

  it('sniff de bytes identifica binários e texto UTF-8', () => {
    expect(detectFileKindFromBytes(new Uint8Array([104, 105]))).toBe('text');
    expect(detectFileKindFromBytes(new Uint8Array([0, 1, 2, 3]))).toBe('binary');
    expect(detectFileKindFromBytes(new TextEncoder().encode('acentuação çãõ'))).toBe('text');
    expect(detectFileKindFromBytes(new Uint8Array([0xff, 0xfe, 0xfd]))).toBe('binary');
    expect(detectFileKindFromBytes(new Uint8Array(0))).toBe('text');
  });

  it('helpers de conveniência', () => {
    expect(isTextFileKind(undefined)).toBe(true);
    expect(isTextFileKind('text')).toBe(true);
    expect(isTextFileKind('binary')).toBe(false);
    expect(isLikelyBinaryByName('foto.jpg')).toBe(true);
    expect(isLikelyBinaryByName('main.py')).toBe(false);
  });
});
