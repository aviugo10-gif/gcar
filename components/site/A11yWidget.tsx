"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";

// A small convenience menu, not a substitute for real accessibility (the site is built to WCAG 2.2 AA from the ground up).
const OPTS = [
  { cls: "a11y-big", label: "הגדלת טקסט" },
  { cls: "a11y-contrast", label: "ניגודיות גבוהה" },
  { cls: "a11y-links", label: "הדגשת קישורים" },
  { cls: "a11y-readable", label: "גופן קריא" },
  { cls: "a11y-still", label: "עצירת אנימציות" },
];

export function A11yWidget() {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState<string[]>([]);
  useEffect(() => {
    try { setOn(JSON.parse(localStorage.getItem("gc-a11y") || "[]")); } catch { /* storage blocked */ }
  }, []);
  const toggle = (c: string) => {
    const next = on.includes(c) ? on.filter((x) => x !== c) : [...on, c];
    setOn(next);
    document.documentElement.classList.toggle(c, next.includes(c));
    try { localStorage.setItem("gc-a11y", JSON.stringify(next)); } catch { /* ignore */ }
  };
  const theme = () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("gc-theme", t); } catch { /* ignore */ }
  };
  return (
    <>
      <button className="a11y-btn" aria-label="תפריט נגישות" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="accessibility" /></button>
      {open && (
        <div className="sheet-wrap" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div className="gc-scrim" style={{ position: "absolute", inset: 0 }} onClick={() => setOpen(false)} />
          <div className="gc-sheet" role="dialog" aria-modal="true" aria-labelledby="a11y-t" style={{ position: "relative" }}>
            <div className="gc-sheet__grab" />
            <div className="gc-sheet__head"><h2 className="gc-sheet__title" id="a11y-t">נגישות</h2><button className="gc-btn gc-btn--ghost gc-btn--icon" aria-label="סגירה" onClick={() => setOpen(false)} autoFocus><Icon name="x" /></button></div>
            <div className="gc-stack">
              {OPTS.map((o) => (
                <button key={o.cls} className="gc-chip" aria-pressed={on.includes(o.cls)} onClick={() => toggle(o.cls)} style={{ justifyContent: "space-between", height: 48 }}>
                  {o.label}{on.includes(o.cls) && <Icon name="check" size="sm" />}
                </button>
              ))}
              <button className="gc-chip" style={{ height: 48 }} onClick={theme}>מצב כהה / בהיר</button>
              <Link href="/accessibility" className="gc-btn gc-btn--ghost">להצהרת הנגישות</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
