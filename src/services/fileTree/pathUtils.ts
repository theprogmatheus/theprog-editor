/**
 * Utilitários para validação, sanitização e manipulação de caminhos na árvore de arquivos.
 */

/**
 * Normaliza e divide um caminho em segmentos limpos.
 * Ex: "src/components//Button.tsx" -> ["src", "components", "Button.tsx"]
 */
export function splitPathSegments(rawPath: string): string[] {
  const normalized = rawPath.replace(/\\/g, '/').trim();
  return normalized
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Valida se uma string de caminho pode ser usada para criar arquivos ou pastas.
 * Permite barras '/' para caminhos aninhados, mas proíbe '..', caracteres ilegais e de controle.
 */
export function isPathValidForCreation(rawPath: string): boolean {
  const trimmed = rawPath.replace(/\\/g, '/').trim();
  if (!trimmed) return false;

  // Proíbe caminhos que comecem ou terminem com barra dupla
  if (trimmed.includes('//')) return false;

  const segments = splitPathSegments(trimmed);
  if (segments.length === 0) return false;

  for (const seg of segments) {
    if (seg === '.' || seg === '..') return false;
    // Caracteres proibidos em Windows/Linux/Web VFS
    if (/[<>:"|?*]/.test(seg)) return false;
    for (let i = 0; i < seg.length; i++) {
      if (seg.charCodeAt(i) < 32) return false;
    }
  }

  return true;
}

/**
 * Retorna o nome base do caminho (último segmento).
 * Ex: "/src/main.c" -> "main.c"
 */
export function getBaseName(path: string): string {
  const segments = splitPathSegments(path);
  return segments.length > 0 ? segments[segments.length - 1] : '';
}

/**
 * Retorna o diretório pai de um caminho.
 * Ex: "/src/components/Button.tsx" -> "/src/components"
 * Ex: "/main.c" -> ""
 */
export function getDirName(path: string): string {
  const segments = splitPathSegments(path);
  if (segments.length <= 1) return '';
  return '/' + segments.slice(0, -1).join('/');
}
