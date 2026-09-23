export interface ProjectBuildConfig {
  compiler?: 'clang' | 'clang++';
  entry?: string;
  sources?: string[];
  flags?: string[];
}

export const PROJECT_CONFIG_PATH = '.theprog/project.json';

export function parseBuildConfig(content: string): ProjectBuildConfig | null {
  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      compiler: parsed.compiler === 'clang++' ? 'clang++' : parsed.compiler === 'clang' ? 'clang' : undefined,
      entry: typeof parsed.entry === 'string' ? parsed.entry : undefined,
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.filter((s: unknown) => typeof s === 'string')
        : undefined,
      flags: Array.isArray(parsed.flags)
        ? parsed.flags.filter((f: unknown) => typeof f === 'string')
        : undefined,
    };
  } catch {
    return null;
  }
}

export function serializeBuildConfig(config: ProjectBuildConfig): string {
  return JSON.stringify(config, null, 2);
}

const SOURCE_EXT_REGEX = /\.(c|cpp|cc|cxx)$/i;

/**
 * Resolve a lista de arquivos fonte a serem compilados.
 * Prioridade:
 * 1. Arquivo de configuração .theprog/project.json (campo sources)
 * 2. Fallback: Se não houver configuração, inclui o entryFile e outros fontes .c/.cpp
 *    presentes no mapa de arquivos que não definem outra função main()
 */
export function resolveSources(
  files: Map<string, string>,
  entryFile: string
): { sources: string[]; customFlags?: string[]; customCompiler?: 'clang' | 'clang++' } {
  const configRaw = files.get(PROJECT_CONFIG_PATH) || files.get(`/${PROJECT_CONFIG_PATH}`);

  if (configRaw) {
    const config = parseBuildConfig(configRaw);
    if (config?.sources && config.sources.length > 0) {
      const validSources = config.sources.filter((src) => {
        const clean = src.startsWith('/') ? src.slice(1) : src;
        return files.has(clean) || files.has(`/${clean}`);
      });
      if (validSources.length > 0) {
        return {
          sources: validSources,
          customFlags: config.flags,
          customCompiler: config.compiler,
        };
      }
    }
  }

  // Fallback padrão sem configuração declarativa
  const sources: string[] = [entryFile];
  const MAIN_FUNCTION_CHECK = /\b(?:int|void)\s+main\s*\(/;

  files.forEach((content, name) => {
    const cleanName = name.startsWith('/') ? name.slice(1) : name;
    const cleanEntry = entryFile.startsWith('/') ? entryFile.slice(1) : entryFile;

    if (cleanName !== cleanEntry && SOURCE_EXT_REGEX.test(cleanName)) {
      if (!MAIN_FUNCTION_CHECK.test(content)) {
        sources.push(cleanName);
      }
    }
  });

  return { sources };
}
