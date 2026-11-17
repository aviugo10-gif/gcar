"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "../Icon";

type T = { id: number; msg: string; undo?: () => void };
const Ctx = createContext<(msg: string, undo?: () => void) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** "Do it, offer undo" instead of "are you sure?". 5 seconds, paused while touched. No entrance animation (repeated action). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, undo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setT({ id: Date.now(), msg, undo });
    timer.current = setTimeout(() => setT(null), 5000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" style={{ position: "fixed", insetInline: 16, bottom: "calc(var(--nav-h) + 28px + env(safe-area-inset-bottom))", zIndex: 80, maxWidth: 520, margin: "0 auto" }}>
        {t && (
          <div className="gc-toast" role="status" onPointerDown={() => timer.current && clearTimeout(timer.current)} onPointerUp={() => (timer.current = setTimeout(() => setT(null), 3000))}>
            <span className="gc-toast__msg"><Icon name="check" />{t.msg}</span>
            {t.undo && <button className="gc-toast__undo" onClick={() => { t.undo!(); setT(null); }}><Icon name="undo" size="sm" />ביטול</button>}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
