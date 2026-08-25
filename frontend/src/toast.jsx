// Minimal toast system, no dependency needed.
import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, kind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all, { id, message, kind }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
