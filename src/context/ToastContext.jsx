import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Toast from '../components/feedback/Toast';

const ToastContext = createContext(null);

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, tone = 'info', ms = 4200) => {
    const id = ++seq;
    setToasts((list) => [...list, { id, message, tone }]);
    setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({
    toast: push,
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="toasts">
          {toasts.map((t) => <Toast key={t.id} toast={t} onDismiss={dismiss} />)}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
