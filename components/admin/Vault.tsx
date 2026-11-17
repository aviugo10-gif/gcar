"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { unlockVault, seal, open, VaultError, type VaultRecord } from "@/lib/vault";
import { getVault } from "@/app/admin/actions";
import { Sheet } from "./Sheet";
import { Icon } from "../Icon";

// The vault key lives only here, in memory, as a non-extractable CryptoKey. It is dropped after inactivity
// (5 minutes), when the app goes to the background, and on sign-out.
type Ctx = {
  unlocked: boolean;
  /** Ask for the password if needed. Resolves to true once unlocked. */
  ensure: (reason?: string) => Promise<boolean>;
  lock: () => void;
  seal: (field: string, v: unknown) => Promise<string>;
  open: <T>(field: string, token: string) => Promise<T>;
  touch: () => void;
};
const VaultCtx = createContext<Ctx | null>(null);
export const useVault = () => useContext(VaultCtx)!;
const IDLE_MS = 5 * 60_000;

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const key = useRef<CryptoKey | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [ask, setAsk] = useState<{ reason: string; resolve: (ok: boolean) => void } | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    key.current = null;
    setUnlocked(false);
  }, []);
  const touch = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    if (key.current) idle.current = setTimeout(lock, IDLE_MS);
  }, [lock]);
  useEffect(() => {
    const hide = () => document.visibilityState === "hidden" && lock();
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [lock]);

  const ensure = useCallback((reason = "פתיחת הכספת") => {
    if (key.current) { touch(); return Promise.resolve(true); }
    return new Promise<boolean>((resolve) => setAsk({ reason, resolve }));
  }, [touch]);

  const ctx: Ctx = {
    unlocked, ensure, lock, touch,
    seal: async (f, v) => { if (!key.current) throw new VaultError("locked"); touch(); return seal(key.current, f, v); },
    open: async <T,>(f: string, t: string) => { if (!key.current) throw new VaultError("locked"); return open<T>(key.current, f, t); },
  };
  return (
    <VaultCtx.Provider value={ctx}>
      {children}
      {ask && (
        <UnlockSheet
          reason={ask.reason}
          onDone={(k) => {
            if (k) { key.current = k; setUnlocked(true); touch(); }
            ask.resolve(!!k);
            setAsk(null);
          }}
        />
      )}
    </VaultCtx.Provider>
  );
}

function UnlockSheet({ reason, onDone }: { reason: string; onDone: (k: CryptoKey | null) => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rec, setRec] = useState<VaultRecord | null | undefined>(undefined);
  useEffect(() => { getVault().then((r) => setRec(r as VaultRecord | null)); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rec) return;
    setBusy(true); setErr("");
    try { onDone(await unlockVault(pw, rec)); }
    catch { setErr("סיסמת הכספת לא נכונה"); setBusy(false); }
  }
  return (
    <Sheet title={reason} onClose={() => onDone(null)}>
      {rec === null ? (
        <div className="gc-stack"><p className="gc-muted">הכספת עוד לא הוגדרה. מגדירים אותה פעם אחת בהגדרות.</p><a className="gc-btn gc-btn--primary" href="/admin/settings#vault">להגדרת הכספת</a></div>
      ) : (
        <form className="form" onSubmit={submit}>
          <p className="gc-muted">המחירים והכספים מוצפנים במכשיר. רק סיסמת הכספת פותחת אותם, והיא לא נשמרת בשום מקום.</p>
          <label className="gc-field"><span className="gc-field__label">סיסמת כספת</span><span className="gc-field__control"><Icon name="key" size="sm" /><input type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></span></label>
          {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
          <button className="gc-btn gc-btn--primary gc-btn--block" disabled={busy || !rec || !pw}>{busy ? "פותח…" : "פתיחה"}</button>
        </form>
      )}
    </Sheet>
  );
}
