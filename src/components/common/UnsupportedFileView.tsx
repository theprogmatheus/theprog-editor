import React from 'react';
import { FileWarning, Download, FileType2 } from 'lucide-react';
import type { FileItem } from '../../types/editor';

interface UnsupportedFileViewProps {
  file: FileItem;
  onForceText?: () => void;
}

function formatBytes(size?: number): string {
  if (!size || size <= 0) return 'tamanho desconhecido';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getExtensionLabel(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return 'sem extensão';
  return filename.slice(dot + 1).toLowerCase();
}

export const UnsupportedFileView: React.FC<UnsupportedFileViewProps> = ({ file, onForceText }) => {
  const handleDownload = async () => {
    try {
      const handle = file.handle as FileSystemFileHandle | undefined;
      if (!handle || typeof handle.getFile !== 'function') return;
      const diskFile = await handle.getFile();
      const url = URL.createObjectURL(diskFile);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Não foi possível baixar o arquivo:', err);
    }
  };

  const hasHandle = Boolean(file.handle && typeof (file.handle as FileSystemFileHandle).getFile === 'function');

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1e1e1e] text-[#616161] dark:text-[#858585] select-none p-6 transition-colors text-center">
      <FileWarning className="w-16 h-16 text-[#cccccc] dark:text-[#333333] mb-4 stroke-1" />
      <h2 className="text-base font-medium text-[#333333] dark:text-[#cccccc] mb-1">
        Visualização não suportada
      </h2>
      <p className="text-xs text-[#777777] max-w-sm mb-5">
        Arquivos binários não podem ser exibidos ou editados como texto no TheProg Editor.
      </p>

      <div className="flex items-center space-x-3 text-[11px] font-mono text-[#555555] dark:text-[#999999] mb-5">
        <span className="px-2 py-0.5 rounded bg-[#ececec] dark:bg-[#2a2a2a] border border-[#dddddd] dark:border-[#3a3a3a]">
          {getExtensionLabel(file.name)}
        </span>
        <span>{formatBytes(file.size)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {hasHandle && (
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-medium cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar arquivo</span>
          </button>
        )}
        {onForceText && (
          <button
            onClick={onForceText}
            title="Tenta exibir o conteúdo bruto como texto (somente leitura)"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#f0f0f0] hover:bg-[#e4e4e4] dark:bg-[#333333] dark:hover:bg-[#3d3d3d] text-[#444444] dark:text-[#cccccc] border border-[#cccccc] dark:border-[#3e3e42] text-xs font-medium cursor-pointer transition-colors"
          >
            <FileType2 className="w-3.5 h-3.5" />
            <span>Forçar abrir como texto</span>
          </button>
        )}
      </div>
    </div>
  );
};
