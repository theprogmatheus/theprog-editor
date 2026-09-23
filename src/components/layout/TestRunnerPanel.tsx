import React, { useState, useEffect } from 'react';
import {
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { useEditor } from '../../context/EditorContext';
import {
  type TestCase,
  type TestResult,
  parseTestCases,
  serializeTestCases,
  runSingleTestCase,
  TESTS_CONFIG_PATH,
} from '../../services/testRunner';
import { getFileRunPlan } from '../../utils/runPlanHelper';

export const TestRunnerPanel: React.FC = () => {
  const { files, activeFile, compilerFlags, createNewFile, updateFileContent } = useEditor();

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [results, setResults] = useState<Map<string, TestResult>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [activeTestIndex, setActiveTestIndex] = useState<number | null>(null);
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());

  // Novo caso de teste (estado do formulário inline)
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStdin, setNewStdin] = useState('');
  const [newExpected, setNewExpected] = useState('');

  // Carrega casos de teste existentes de .theprog/tests.json
  useEffect(() => {
    const testFile = files.find(
      (f) => f.path === TESTS_CONFIG_PATH || f.path === `/${TESTS_CONFIG_PATH}`
    );
    if (testFile?.content) {
      setTestCases(parseTestCases(testFile.content));
    } else {
      setTestCases((prev) =>
        prev.length === 0
          ? [
              {
                id: 'case-1',
                title: 'Exemplo Inicial',
                stdin: '10 20\n',
                expectedStdout: '30\n',
                timeoutMs: 3000,
              },
            ]
          : prev
      );
    }
  }, [files]);

  // Persiste casos de teste em .theprog/tests.json
  const persistTests = async (updated: TestCase[]) => {
    setTestCases(updated);
    const serialized = serializeTestCases(updated);
    const existing = files.find(
      (f) => f.path === TESTS_CONFIG_PATH || f.path === `/${TESTS_CONFIG_PATH}` || f.name === 'tests.json'
    );
    if (existing) {
      updateFileContent(existing.id, serialized);
    } else {
      let folder = files.find((f) => f.isFolder && (f.name === '.theprog' || f.path === '/.theprog'));
      let folderId = folder ? folder.id : null;
      if (!folderId) {
        try {
          folderId = await createNewFile('.theprog', true, null);
        } catch {
          // ignora se já existe
        }
      }
      await createNewFile('tests.json', false, folderId, serialized);
    }
  };

  const handleAddTestCase = async () => {
    if (!newTitle.trim()) return;
    const newCase: TestCase = {
      id: `case-${Date.now()}`,
      title: newTitle.trim(),
      stdin: newStdin,
      expectedStdout: newExpected,
      timeoutMs: 3000,
    };
    const updated = [...testCases, newCase];
    await persistTests(updated);
    setIsAdding(false);
    setNewTitle('');
    setNewStdin('');
    setNewExpected('');
  };

  const handleDeleteTest = async (id: string) => {
    const updated = testCases.filter((t) => t.id !== id);
    await persistTests(updated);
    setResults((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const handleRunAllTests = async () => {
    if (!activeFile || isRunning) return;
    const scopedFiles = new Map<string, string>();
    files.forEach((f) => {
      if (!f.isFolder && f.content !== undefined) {
        const clean = f.path.startsWith('/') ? f.path.slice(1) : f.path;
        scopedFiles.set(clean, f.content);
      }
    });

    const plan = getFileRunPlan(activeFile, scopedFiles, compilerFlags);
    if (!plan) return;

    setIsRunning(true);
    const newResults = new Map<string, TestResult>();

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      setActiveTestIndex(i);
      newResults.set(tc.id, {
        testId: tc.id,
        verdict: 'running',
        actualStdout: '',
        durationMs: 0,
      });
      setResults(new Map(newResults));

      const res = await runSingleTestCase(plan, tc);
      newResults.set(tc.id, res);
      setResults(new Map(newResults));
    }

    setActiveTestIndex(null);
    setIsRunning(false);
  };

  const toggleDiff = (id: string) => {
    setExpandedDiffs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#1e1e1e] text-[#333333] dark:text-[#cccccc] text-xs overflow-hidden select-none">
      {/* Barra de Ações Superior */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#2d2d2d] bg-[#f9f9f9] dark:bg-[#252526] shrink-0">
        <div className="flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-[#007acc] dark:text-[#3794ff]" />
          <span className="font-semibold text-black dark:text-white">Casos de Teste & Validação</span>
          <span className="px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 text-[10px] text-neutral-600 dark:text-neutral-400">
            {testCases.length} {testCases.length === 1 ? 'caso' : 'casos'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-black dark:text-white text-[11px] font-medium cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Adicionar Caso</span>
          </button>

          <button
            onClick={handleRunAllTests}
            disabled={isRunning || testCases.length === 0 || !activeFile}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-white text-[11px] font-semibold cursor-pointer shadow-xs transition-all ${
              isRunning || testCases.length === 0 || !activeFile
                ? 'bg-neutral-400 dark:bg-neutral-600 opacity-60 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>
              {isRunning
                ? activeTestIndex !== null
                  ? `Executando (${activeTestIndex + 1}/${testCases.length})...`
                  : 'Executando...'
                : 'Executar Casos'}
            </span>
          </button>
        </div>
      </div>

      {/* Formulário Inline de Novo Caso */}
      {isAdding && (
        <div className="p-3 border-b border-[#e5e5e5] dark:border-[#2d2d2d] bg-[#f5f5f5] dark:bg-[#202021] space-y-2 shrink-0 animate-in fade-in duration-100">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black dark:text-white">Novo Caso de Teste</span>
            <button
              onClick={() => setIsAdding(false)}
              className="text-[#888888] hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
          </div>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título (ex: Caso de Borda - Números Negativos)"
            className="w-full px-2.5 py-1 text-xs rounded border border-[#cccccc] dark:border-[#404040] bg-white dark:bg-[#2d2d2d] text-black dark:text-white focus:outline-none focus:border-[#007acc]"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[#666666] dark:text-[#999999] mb-1">
                Entrada (stdin):
              </label>
              <textarea
                value={newStdin}
                onChange={(e) => setNewStdin(e.target.value)}
                placeholder="10 20"
                rows={2}
                className="w-full font-mono text-[11px] p-2 rounded border border-[#cccccc] dark:border-[#404040] bg-white dark:bg-[#2d2d2d] text-black dark:text-white focus:outline-none focus:border-[#007acc]"
              />
            </div>
            <div>
              <label className="block text-[10px] text-[#666666] dark:text-[#999999] mb-1">
                Saída Esperada (stdout):
              </label>
              <textarea
                value={newExpected}
                onChange={(e) => setNewExpected(e.target.value)}
                placeholder="30"
                rows={2}
                className="w-full font-mono text-[11px] p-2 rounded border border-[#cccccc] dark:border-[#404040] bg-white dark:bg-[#2d2d2d] text-black dark:text-white focus:outline-none focus:border-[#007acc]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleAddTestCase}
              className="px-3 py-1 bg-[#007acc] text-white rounded text-[11px] font-medium hover:bg-[#0062a3] cursor-pointer"
            >
              Salvar Caso
            </button>
          </div>
        </div>
      )}

      {/* Lista de Casos de Teste com Resultados */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 select-text">
        {testCases.map((tc, index) => {
          const res = results.get(tc.id);
          const isExpanded = expandedDiffs.has(tc.id);

          return (
            <div
              key={tc.id}
              className={`p-2.5 rounded-lg border transition-colors ${
                res?.verdict === 'accepted'
                  ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : res?.verdict === 'wrong_answer'
                  ? 'border-rose-300 dark:border-rose-800/60 bg-rose-50/40 dark:bg-rose-950/20'
                  : res?.verdict === 'time_limit'
                  ? 'border-amber-300 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20'
                  : res?.verdict === 'runtime_error'
                  ? 'border-purple-300 dark:border-purple-800/60 bg-purple-50/40 dark:bg-purple-950/20'
                  : 'border-[#e0e0e0] dark:border-[#333333] bg-neutral-50/50 dark:bg-[#252526]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {res?.verdict === 'accepted' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : res?.verdict === 'wrong_answer' ? (
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  ) : res?.verdict === 'time_limit' ? (
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : res?.verdict === 'runtime_error' ? (
                    <AlertTriangle className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  ) : res?.verdict === 'running' ? (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-600 ml-1 shrink-0" />
                  )}

                  <span className="font-semibold text-black dark:text-white">
                    #{index + 1} {tc.title}
                  </span>

                  {res && res.verdict !== 'running' && (
                    <span className="text-[10px] text-[#888888] font-mono">
                      ({res.durationMs.toFixed(1)}ms)
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {res?.verdict && res.verdict !== 'running' && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        res.verdict === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : res.verdict === 'wrong_answer'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                          : res.verdict === 'time_limit'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                      }`}
                    >
                      {res.verdict === 'accepted'
                        ? 'Accepted (AC)'
                        : res.verdict === 'wrong_answer'
                        ? 'Wrong Answer (WA)'
                        : res.verdict === 'time_limit'
                        ? 'Time Limit (TLE)'
                        : 'Runtime Error (RE)'}
                    </span>
                  )}

                  {res && (
                    <button
                      onClick={() => toggleDiff(tc.id)}
                      className="p-1 text-[#888888] hover:text-black dark:hover:text-white cursor-pointer"
                      title="Ver detalhes de saída"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteTest(tc.id)}
                    className="p-1 text-[#888888] hover:text-rose-600 cursor-pointer"
                    title="Remover caso"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Visualização de Diff Lado a Lado se Expandido */}
              {isExpanded && res && (
                <div className="mt-2 pt-2 border-t border-[#e0e0e0] dark:border-[#333333] grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333333]">
                    <span className="text-[10px] uppercase font-sans font-semibold text-[#888888] block mb-1">
                      Esperado:
                    </span>
                    <pre className="whitespace-pre-wrap text-emerald-700 dark:text-emerald-400">
                      {tc.expectedStdout || '(vazio)'}
                    </pre>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-[#1a1a1a] border border-[#e0e0e0] dark:border-[#333333]">
                    <span className="text-[10px] uppercase font-sans font-semibold text-[#888888] block mb-1">
                      Obtido:
                    </span>
                    <pre
                      className={`whitespace-pre-wrap ${
                        res.verdict === 'accepted'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {res.actualStdout || '(vazio)'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
