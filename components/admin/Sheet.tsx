"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../Icon";

/** Bottom sheet on phones, centred dialog from 768px. Focus is trapped and returns to the opener. Drag down to close. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const y0 = useRef<number | null>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusables = () => [...el.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])")].filter((x) => !x.hasAttribute("disabled"));
    if (!el.contains(document.activeElement)) (focusables()[1] ?? focusables()[0])?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; opener?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div className="sheet-wrap">
      <div className="gc-scrim" style={{ position: "absolute", inset: 0 }} onClick={onClose} />
      <div className="gc-sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={{ position: "relative" }}
        onTouchStart={(e) => { if ((e.target as HTMLElement).closest(".gc-sheet__grab,.gc-sheet__head")) y0.current = e.touches[0].clientY; }}
        onTouchMove={(e) => { if (y0.current !== null) { const d = Math.max(0, e.touches[0].clientY - y0.current); ref.current!.style.transform = `translateY(${d}px)`; } }}
        onTouchEnd={(e) => { if (y0.current !== null) { const d = e.changedTouches[0].clientY - y0.current; ref.current!.style.transform = ""; y0.current = null; if (d > 90) onClose(); } }}>
        <div className="gc-sheet__grab" />
        <div className="gc-sheet__head"><h2 className="gc-sheet__title">{title}</h2><button className="gc-btn gc-btn--ghost gc-btn--icon" aria-label="סגירה" onClick={onClose}><Icon name="x" /></button></div>
        {children}
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
