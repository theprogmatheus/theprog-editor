import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { FileItem } from '../../types/editor';
import { UnsupportedFileView } from './UnsupportedFileView';

interface ImagePreviewProps {
  file: FileItem;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setUrl(null);
    setHasError(false);

    (async () => {
      try {
        const handle = file.handle as FileSystemFileHandle | undefined;
        if (!handle || typeof handle.getFile !== 'function') {
          throw new Error('Arquivo sem acesso direto no disco');
        }
        const diskFile = await handle.getFile();
        objectUrl = URL.createObjectURL(diskFile);
        if (!cancelled) {
          setUrl(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.id, file.updatedAt, file.handle]);

  if (hasError) {
    return <UnsupportedFileView file={file} />;
  }

  if (!url) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1e1e1e] text-[#888888] text-xs gap-3">
        <ImageOff className="w-10 h-10 text-[#cccccc] dark:text-[#333333] stroke-1" />
        <span>Carregando imagem...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#f5f5f5] dark:bg-[#141414] p-6 overflow-auto">
      <img
        src={url}
        alt={file.name}
        className="max-w-full max-h-full object-contain rounded shadow-lg border border-[#e0e0e0] dark:border-[#333333]"
      />
    </div>
  );
};
