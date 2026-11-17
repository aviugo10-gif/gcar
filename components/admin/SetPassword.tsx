"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

// Landing page for Supabase invite / password-recovery emails. The link carries a short-lived session in the URL hash;
// we take it, let the user choose a password, then send them to the normal login (password + authenticator code).
export function SetPassword() {
  const router = useRouter();
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const access_token = h.get("access_token"), refresh_token = h.get("refresh_token");
    history.replaceState(null, "", window.location.pathname);
    if (!access_token || !refresh_token) { setReady(false); return; }
    supabaseBrowser().auth.setSession({ access_token, refresh_token }).then((r: { error: unknown }) => setReady(!r.error));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 12) return setErr("לפחות 12 תווים");
    if (pw !== pw2) return setErr("הסיסמאות לא זהות");
    setBusy(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { setBusy(false); return setErr("לא הצלחנו לשמור. בקשו קישור חדש."); }
    await sb.auth.signOut();
    router.replace("/admin/login");
  }

  if (ready === null) return <p className="t-body">רגע…</p>;
  if (!ready) return <p className="t-body">הקישור לא תקף או שפג תוקפו. בקשו קישור חדש.</p>;
  return (
    <form onSubmit={submit} className="stack">
      <h1 className="t-screen">בחירת סיסמה</h1>
      <label className="gc-field"><span className="gc-label">סיסמה חדשה</span>
        <input className="gc-input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} dir="ltr" required /></label>
      <label className="gc-field"><span className="gc-label">שוב, לאימות</span>
        <input className="gc-input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} dir="ltr" required /></label>
      {err && <p className="gc-alert gc-alert--danger" role="alert"><span>{err}</span></p>}
      <button className="gc-btn gc-btn--primary gc-btn--block" disabled={busy}>שמירה והמשך לכניסה</button>
      <p className="t-caption">אחרי השמירה תתבקשו להיכנס ולהגדיר אפליקציית קודים (Google Authenticator או דומה).</p>
    </form>
  );
}
