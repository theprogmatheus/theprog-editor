import React from 'react';
import { Eye } from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  filename: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, filename }) => {
  // Parser de markdown leve e seguro sem dependências pesadas
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let codeLang = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Bloco de código com ```
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <div key={`code-${i}`} className="my-2.5 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden">
              {codeLang ? <div className="px-3 py-1 bg-neutral-800 text-[10px] text-neutral-400 font-mono uppercase">{codeLang}</div> : null}
              <pre className="p-3 text-neutral-100 font-mono text-xs overflow-x-auto">
                <code>{codeBuffer.join('\n')}</code>
              </pre>
            </div>
          );
          codeBuffer = [];
          codeLang = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLang = line.trim().slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Cabeçalhos (# ## ###)
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={i} className="text-xl font-bold text-black dark:text-white mt-4 mb-2 pb-1 border-b border-[#e0e0e0] dark:border-[#333333]">
            {line.slice(2)}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-base font-bold text-black dark:text-white mt-3 mb-1.5 pb-0.5 border-b border-[#e5e5e5] dark:border-[#2a2a2a]">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-sm font-semibold text-black dark:text-white mt-2.5 mb-1">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('> ')) {
        elements.push(
          <blockquote
            key={i}
            className="pl-3 py-1 my-1.5 border-l-4 border-[#007acc] text-[#666666] dark:text-[#999999] bg-[#f0f7ff] dark:bg-[#007acc]/10 italic rounded-r text-xs"
          >
            {line.slice(2)}
          </blockquote>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={i} className="ml-5 list-disc text-xs text-[#333333] dark:text-[#cccccc] my-0.5">
            {line.slice(2)}
          </li>
        );
      } else if (/^\d+\.\s/.test(line)) {
        elements.push(
          <li key={i} className="ml-5 list-decimal text-xs text-[#333333] dark:text-[#cccccc] my-0.5">
            {line.replace(/^\d+\.\s/, '')}
          </li>
        );
      } else if (line.trim() === '---' || line.trim() === '***') {
        elements.push(<hr key={i} className="my-3 border-[#e0e0e0] dark:border-[#333333]" />);
      } else if (line.trim()) {
        elements.push(
          <p key={i} className="my-1.5 text-xs text-[#333333] dark:text-[#cccccc] leading-relaxed">
            {line}
          </p>
        );
      }
    }

    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <pre
          key="code-end"
          className="p-3 my-2 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto border border-neutral-800"
        >
          <code>{codeBuffer.join('\n')}</code>
        </pre>
      );
    }

    return elements;
  };

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#1e1e1e] overflow-hidden select-text">
      {/* Barra de título do preview */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#252526] bg-[#f9f9f9] dark:bg-[#252526] text-xs font-semibold text-[#666666] dark:text-[#999999] shrink-0">
        <div className="flex items-center space-x-1.5">
          <Eye className="w-3.5 h-3.5 text-[#007acc] dark:text-[#3794ff]" />
          <span>Pré-visualização: {filename}</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
          Markdown Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {content ? renderMarkdown(content) : (
          <div className="text-center text-[#888888] py-12">Documento vazio.</div>
        )}
      </div>
    </div>
  );
};
