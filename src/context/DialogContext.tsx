import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, AlertCircle, X, Terminal } from 'lucide-react';

interface AlertOptions {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  confirmText?: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogContextType {
  showAlert: (options: AlertOptions | string) => Promise<void>;
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showPrompt: (options: PromptOptions | string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

type DialogState =
  | {
      type: 'alert';
      title: string;
      message: string;
      alertType: 'info' | 'warning' | 'error' | 'success';
      confirmText: string;
      resolve: () => void;
    }
  | {
      type: 'confirm';
      title: string;
      message: string;
      confirmText: string;
      cancelText: string;
      danger: boolean;
      resolve: (result: boolean) => void;
    }
  | {
      type: 'prompt';
      title: string;
      message: string;
      placeholder: string;
      defaultValue: string;
      confirmText: string;
      cancelText: string;
      resolve: (result: string | null) => void;
    };

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialog && dialog.type === 'prompt') {
      setPromptValue(dialog.defaultValue || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [dialog]);

  const showAlert = (options: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts: AlertOptions = typeof options === 'string' ? { message: options } : options;
      setDialog({
        type: 'alert',
        title: opts.title || 'Aviso',
        message: opts.message,
        alertType: opts.type || 'info',
        confirmText: opts.confirmText || 'OK',
        resolve: () => {
          setDialog(null);
          resolve();
        },
      });
    });
  };

  const showConfirm = (options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
      setDialog({
        type: 'confirm',
        title: opts.title || 'Confirmar Ação',
        message: opts.message,
        confirmText: opts.confirmText || 'Confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        danger: opts.danger ?? false,
        resolve: (res: boolean) => {
          setDialog(null);
          resolve(res);
        },
      });
    });
  };

  const showPrompt = (options: PromptOptions | string): Promise<string | null> => {
    return new Promise((resolve) => {
      const opts: PromptOptions = typeof options === 'string' ? { message: options } : options;
      setDialog({
        type: 'prompt',
        title: opts.title || 'Informar Dados',
        message: opts.message,
        placeholder: opts.placeholder || '',
        defaultValue: opts.defaultValue || '',
        confirmText: opts.confirmText || 'Criar',
        cancelText: opts.cancelText || 'Cancelar',
        resolve: (res: string | null) => {
          setDialog(null);
          resolve(res);
        },
      });
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!dialog) return;
      if (dialog.type === 'alert') dialog.resolve();
      else if (dialog.type === 'confirm') dialog.resolve(false);
      else if (dialog.type === 'prompt') dialog.resolve(null);
    } else if (e.key === 'Enter') {
      if (!dialog) return;
      if (dialog.type === 'alert') dialog.resolve();
      else if (dialog.type === 'confirm') dialog.resolve(true);
      else if (dialog.type === 'prompt') dialog.resolve(promptValue.trim());
    }
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}

      {dialog && (
        <div
          onKeyDown={handleKeyDown}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
        >
          <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-[#252526] border border-[#e5e5e5] dark:border-[#3e3e42] rounded-xl shadow-2xl text-[#333333] dark:text-[#cccccc] overflow-hidden flex flex-col transition-colors">
            {/* Topo do Diálogo */}
            <div className="h-11 px-4 flex items-center justify-between border-b border-[#e5e5e5] dark:border-[#333333] bg-[#f8f8f8] dark:bg-[#1f1f1f] shrink-0">
              <div className="flex items-center space-x-2">
                {dialog.type === 'alert' && (
                  <>
                    {dialog.alertType === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                    {dialog.alertType === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    {dialog.alertType === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {dialog.alertType === 'info' && <Info className="w-4 h-4 text-sky-500" />}
                  </>
                )}
                {dialog.type === 'confirm' && (
                  dialog.danger ? <AlertTriangle className="w-4 h-4 text-rose-500" /> : <Info className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />
                )}
                {dialog.type === 'prompt' && <Terminal className="w-4 h-4 text-[#007acc] dark:text-[#3794ff]" />}

                <h3 className="text-xs font-semibold text-black dark:text-white">{dialog.title}</h3>
              </div>

              <button
                onClick={() => {
                  if (dialog.type === 'alert') dialog.resolve();
                  else if (dialog.type === 'confirm') dialog.resolve(false);
                  else if (dialog.type === 'prompt') dialog.resolve(null);
                }}
                className="p-1 rounded hover:bg-[#eaeaea] dark:hover:bg-[#333333] text-[#777777] hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Corpo com scroll */}
            <div className="p-4 space-y-3 text-xs flex-1 overflow-y-auto">
              <p className="text-[#555555] dark:text-[#bbbbbb] leading-relaxed whitespace-pre-wrap">{dialog.message}</p>

              {dialog.type === 'prompt' && (
                <div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={promptValue}
                    placeholder={dialog.placeholder}
                    onChange={(e) => setPromptValue(e.target.value)}
                    className="w-full bg-white dark:bg-[#1e1e1e] border border-[#cccccc] dark:border-[#3e3e42] rounded px-3 py-1.5 text-xs text-black dark:text-white outline-none focus:border-[#007acc] transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Ações / Botões */}
            <div className="h-12 px-4 bg-[#f8f8f8] dark:bg-[#1e1e1e] border-t border-[#e5e5e5] dark:border-[#333333] flex items-center justify-end space-x-2 shrink-0">
              {dialog.type === 'alert' && (
                <button
                  onClick={() => dialog.resolve()}
                  autoFocus
                  className="px-4 py-1 rounded bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-medium cursor-pointer transition-colors"
                >
                  {dialog.confirmText}
                </button>
              )}

              {dialog.type === 'confirm' && (
                <>
                  <button
                    onClick={() => dialog.resolve(false)}
                    className="px-3 py-1 rounded hover:bg-[#eaeaea] dark:hover:bg-[#333333] text-[#666666] dark:text-[#cccccc] text-xs font-medium cursor-pointer transition-colors"
                  >
                    {dialog.cancelText}
                  </button>
                  <button
                    onClick={() => dialog.resolve(true)}
                    autoFocus
                    className={`px-4 py-1 rounded text-white text-xs font-medium cursor-pointer transition-colors ${
                      dialog.danger
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-[#007acc] hover:bg-[#0062a3]'
                    }`}
                  >
                    {dialog.confirmText}
                  </button>
                </>
              )}

              {dialog.type === 'prompt' && (
                <>
                  <button
                    onClick={() => dialog.resolve(null)}
                    className="px-3 py-1 rounded hover:bg-[#eaeaea] dark:hover:bg-[#333333] text-[#666666] dark:text-[#cccccc] text-xs font-medium cursor-pointer transition-colors"
                  >
                    {dialog.cancelText}
                  </button>
                  <button
                    onClick={() => dialog.resolve(promptValue.trim())}
                    className="px-4 py-1 rounded bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-medium cursor-pointer transition-colors"
                  >
                    {dialog.confirmText}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
