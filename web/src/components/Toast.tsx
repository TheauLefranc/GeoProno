import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Toast = { id: number; content: ReactNode };
const Ctx = createContext<(content: ReactNode) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((content: ReactNode) => setToast({ id: Date.now(), content }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            {toast.content}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
