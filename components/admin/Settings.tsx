"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { Sheet } from "./Sheet";
import { useVault } from "./Vault";
import { useToast } from "./Toast";
import { setupVault, changeVaultPassword, getVault, signOut } from "@/app/admin/actions";
import { createVault, changePassword, type VaultRecord } from "@/lib/vault";

const strong = (p: string) => p.length >= 12;

export function VaultSettings({ exists }: { exists: boolean }) {
  const vault = useVault();
  const [open, setOpen] = useState<null | "setup" | "change">(null);
  return (
    <>
      <div className="ios-list">
        <div><Icon name="lock" /><span className="grow">{exists ? (vault.unlocked ? "פתוחה עכשיו (ננעלת אחרי 5 דקות)" : "נעולה") : "עוד לא הוגדרה"}</span>{vault.unlocked && <button className="gc-btn gc-btn--ghost gc-btn--sm" onClick={vault.lock}>נעילה</button>}</div>
        {exists ? <button className="ios-btn" onClick={() => setOpen("change")}><Icon name="key" /><span className="grow">החלפת סיסמת כספת</span><Icon name="chevron-left" /></button>
          : <button className="ios-btn" onClick={() => setOpen("setup")}><Icon name="key" /><span className="grow">הגדרת כספת</span><Icon name="chevron-left" /></button>}
      </div>
      <p className="t-caption">מחירי קנייה, מינימום וכל נתוני הכספים מוצפנים במכשיר בסיסמה הזו. אין לה איפוס דרך השרת: רק קוד השחזור.</p>
      {open === "setup" && <Setup onClose={() => setOpen(null)} />}
      {open === "change" && <Change onClose={() => setOpen(null)} />}
    </>
  );
}

function Setup({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [res, setRes] = useState<{ record: VaultRecord; code: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function make() { setBusy(true); const v = await createVault(pw); setRes({ record: v.record, code: v.recoveryCode }); setBusy(false); }
  async function finish() {
    if (!res) return;
    setBusy(true);
    const r = await setupVault(res.record);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onClose(); router.refresh();
  }
  return (
    <Sheet title="הגדרת כספת" onClose={onClose}>
      {!res ? (
        <div className="form">
          <label className="gc-field"><span className="gc-field__label">סיסמת כספת (12 תווים לפחות)</span><span className="gc-field__control"><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></span><span className="gc-field__hint">שונה מסיסמת הכניסה. משפט קצר שקל לזכור עובד מצוין.</span></label>
          <label className="gc-field"><span className="gc-field__label">שוב, לאימות</span><span className="gc-field__control"><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></span></label>
          <button className="gc-btn gc-btn--primary gc-btn--block" disabled={!strong(pw) || pw !== pw2 || busy} onClick={make}>{busy ? "יוצר מפתח…" : "המשך"}</button>
        </div>
      ) : (
        <div className="form">
          <div className="alert alert--warn"><Icon name="alert" />זה קוד השחזור היחיד. בלעדיו ובלי הסיסמה אי אפשר לשחזר את הנתונים, גם לא אנחנו. כותבים אותו על נייר ושומרים במקום בטוח.</div>
          <div className="recovery gc-num" dir="ltr">{res.code}</div>
          <button className="gc-btn gc-btn--outline gc-btn--block" onClick={() => window.print()}><Icon name="file-text" />הדפסה</button>
          <label className="gc-check"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /><span>שמרתי את קוד השחזור</span></label>
          {err && <div className="alert alert--danger"><Icon name="alert" />{err}</div>}
          <button className="gc-btn gc-btn--primary gc-btn--block" disabled={!saved || busy} onClick={finish}>סיום</button>
        </div>
      )}
    </Sheet>
  );
}

function Change({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true); setErr("");
    try {
      const rec = (await getVault()) as VaultRecord;
      const next = await changePassword(rec, code, pw);
      const r = await changeVaultPassword(next);
      if (!r.ok) throw new Error(r.error);
      toast("סיסמת הכספת הוחלפה"); onClose();
    } catch (e) {
      setErr(e instanceof Error && e.message === "otp_required" ? "צריך קודם להיכנס לכספים עם קוד אימות" : "קוד השחזור לא נכון");
    }
    setBusy(false);
  }
  return (
    <Sheet title="החלפת סיסמת כספת" onClose={onClose}>
      <div className="form">
        <label className="gc-field"><span className="gc-field__label">קוד שחזור</span><span className="gc-field__control"><input dir="ltr" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-…" /></span></label>
        <label className="gc-field"><span className="gc-field__label">סיסמה חדשה (12 תווים לפחות)</span><span className="gc-field__control"><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></span></label>
        {err && <div className="alert alert--danger"><Icon name="alert" />{err}</div>}
        <button className="gc-btn gc-btn--primary gc-btn--block" disabled={!code || !strong(pw) || busy} onClick={save}>{busy ? "מחליף…" : "החלפה"}</button>
      </div>
    </Sheet>
  );
}

export function ThemeToggle() {
  const [t, setT] = useState<string>("auto");
  useEffect(() => { try { setT(localStorage.getItem("gc-theme") ?? "auto"); } catch {} }, []);
  const set = (v: string) => {
    setT(v);
    try { v === "auto" ? localStorage.removeItem("gc-theme") : localStorage.setItem("gc-theme", v); } catch {}
    const dark = v === "dark" || (v === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };
  return <div><Icon name="sparkles" /><span className="grow">מראה</span><div className="gc-seg" style={{ width: 210 }}>{[["auto", "אוטו׳"], ["light", "בהיר"], ["dark", "כהה"]].map(([k, l]) => <button key={k} aria-selected={t === k} onClick={() => set(k)}>{l}</button>)}</div></div>;
}

export function SignOut() {
  const router = useRouter();
  const vault = useVault();
  return <button className="gc-btn gc-btn--outline gc-btn--block" onClick={async () => { vault.lock(); await signOut(); router.push("/admin/login"); }}><Icon name="log-out" />יציאה</button>;
}
