import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import './Toast.scss';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, opts = {}) => {
      const id = ++toastIdCounter;
      const toast = {
        id,
        message,
        type: opts.type || 'info',
        duration: opts.duration ?? 4000,
        action: opts.action || null,
      };
      setToasts((prev) => [...prev, toast]);
      if (toast.duration > 0) {
        setTimeout(() => dismiss(id), toast.duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = {
    info: (msg, opts) => push(msg, { ...opts, type: 'info' }),
    success: (msg, opts) => push(msg, { ...opts, type: 'success' }),
    error: (msg, opts) => push(msg, { ...opts, type: 'error', duration: opts?.duration ?? 6000 }),
    warning: (msg, opts) => push(msg, { ...opts, type: 'warning' }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (toast.duration <= 0) return;
    const t = setTimeout(() => setClosing(true), toast.duration - 250);
    return () => clearTimeout(t);
  }, [toast.duration]);

  const icon =
    toast.type === 'success' ? '✓' :
    toast.type === 'error' ? '!' :
    toast.type === 'warning' ? '⚠' : 'ℹ';

  return (
    <div className={`toast toast--${toast.type} ${closing ? 'toast--closing' : ''}`} role="status">
      <span className="toast__icon">{icon}</span>
      <span className="toast__msg">{toast.message}</span>
      {toast.action && (
        <button
          className="toast__action"
          onClick={() => {
            toast.action.onClick?.();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="toast__close" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft fallback: log to console if provider missing (avoid crashing the app)
    return {
      info: (m) => console.info('[toast]', m),
      success: (m) => console.info('[toast:success]', m),
      error: (m) => console.error('[toast:error]', m),
      warning: (m) => console.warn('[toast:warning]', m),
      dismiss: () => {},
    };
  }
  return ctx;
}

export default ToastProvider;
