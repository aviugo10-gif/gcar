"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { useVault } from "./Vault";
import { money } from "@/lib/format";

const R = 19, C = 2 * Math.PI * R;
/** Dots until asked; decrypts in the browser, shows for `seconds`, then hides again. The value is never in the DOM while hidden. */
export function PriceReveal({ label, field, token, seconds = 30 }: { label: string; field: string; token?: string | null; seconds?: number }) {
  const vault = useVault();
  const [value, setValue] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = () => { if (t.current) clearInterval(t.current); t.current = null; setValue(null); setLeft(0); };
  useEffect(() => () => hide(), []);
  useEffect(() => { if (!vault.unlocked) hide(); }, [vault.unlocked]);
  async function show() {
    if (!token) return;
    if (!(await vault.ensure("הצגת מחיר מוצפן"))) return;
    setValue(await vault.open<number>(field, token));
    setLeft(seconds);
    const start = Date.now();
    t.current = setInterval(() => {
      const l = seconds - (Date.now() - start) / 1000;
      if (l <= 0) hide(); else setLeft(l);
    }, 100);
  }
  return (
    <div className="gc-reveal">
      <span className="gc-reveal__label"><Icon name="lock" size="sm" />{label}</span>
      {token ? (
        <>
          <span className="gc-reveal__value gc-num" data-hidden={value === null ? "" : undefined}>{value === null ? "••••••" : money(value)}</span>
          <button className="gc-reveal__eye" onClick={() => (value === null ? show() : hide())} aria-label={value === null ? `הצגת ${label}` : "הסתרה"}>
            <Icon name={value === null ? "eye" : "eye-off"} />
            <svg className="gc-reveal__ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - left / seconds)} /></svg>
          </button>
        </>
      ) : (
        <span className="gc-faint">לא הוזן</span>
      )}
    </div>
  );
}
