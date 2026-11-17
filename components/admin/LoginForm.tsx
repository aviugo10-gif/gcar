"use client";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "../Icon";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/admin";
  const [step, setStep] = useState<"password" | "code" | "enroll">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [qr, setQr] = useState<{ svg: string; secret: string; factorId: string } | null>(null);
  const [factorId, setFactorId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const done = () => router.replace(next.startsWith("/admin") ? next : "/admin");

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (demo) { setStep("code"); setTimeout(() => boxes.current[0]?.focus(), 50); return; }
    setBusy(true);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { setBusy(false); return setErr("האימייל או הסיסמה לא נכונים"); }
    const { data } = await sb.auth.mfa.listFactors();
    const totp = data?.totp?.find((f: { status: string; id: string }) => f.status === "verified");
    if (totp) { setFactorId(totp.id); setStep("code"); }
    else {
      // first sign-in: set up the authenticator app (Google Authenticator / Authy / iCloud Keychain)
      const { data: en, error: enErr } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "gcar" });
      if (enErr || !en) { setBusy(false); return setErr("לא הצלחנו להתחיל הגדרת קוד אימות"); }
      setQr({ svg: en.totp.qr_code, secret: en.totp.secret, factorId: en.id });
      setFactorId(en.id);
      setStep("enroll");
    }
    setBusy(false);
    setTimeout(() => boxes.current[0]?.focus(), 50);
  }

  async function verify(full: string) {
    setBusy(true); setErr("");
    if (demo) {
      const r = await fetch("/api/demo-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, code: full }) });
      setBusy(false);
      if (r.ok) return done();
      setStep(r.status === 401 && (await r.json()).error === "password" ? "password" : "code");
      return setErr(r.status === 429 ? "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." : "הסיסמה או הקוד לא נכונים");
    }
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId, code: full });
    setBusy(false);
    if (error) { setCode(["", "", "", "", "", ""]); boxes.current[0]?.focus(); return setErr("הקוד לא נכון או שפג תוקפו"); }
    done();
  }

  function onDigit(i: number, v: string) {
    const digits = v.replace(/\D/g, "");
    if (digits.length > 1) {
      // pasted or autofilled the whole code
      const all = digits.slice(0, 6).split("");
      const nextCode = [...code];
      all.forEach((d, k) => (nextCode[k] = d));
      setCode(nextCode);
      if (nextCode.every(Boolean)) verify(nextCode.join(""));
      return;
    }
    const nextCode = [...code];
    nextCode[i] = digits;
    setCode(nextCode);
    if (digits && i < 5) boxes.current[i + 1]?.focus();
    if (nextCode.every(Boolean)) verify(nextCode.join(""));
  }

  if (step === "password")
    return (
      <form className="form" onSubmit={submitPassword}>
        <h1 className="t-screen">כניסה לניהול</h1>
        {!demo && <label className="gc-field"><span className="gc-field__label">אימייל</span><span className="gc-field__control"><input type="email" autoComplete="username" dir="ltr" style={{ textAlign: "right" }} value={email} onChange={(e) => setEmail(e.target.value)} required /></span></label>}
        <label className="gc-field"><span className="gc-field__label">סיסמה</span><span className="gc-field__control"><Icon name="lock" size="sm" /><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus /></span></label>
        {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
        <button className="gc-btn gc-btn--primary gc-btn--block" disabled={busy}>{busy ? "בודק…" : "המשך"}</button>
      </form>
    );
  return (
    <div className="form">
      <h1 className="t-screen">{step === "enroll" ? "הגדרת קוד אימות" : "קוד אימות"}</h1>
      {step === "enroll" && qr && (
        <div className="gc-stack" style={{ alignItems: "center" }}>
          <p className="gc-muted">סורקים את הקוד באפליקציית אימות (Google Authenticator או דומה), ומקלידים את 6 הספרות שמופיעות בה.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.svg} alt="קוד QR להגדרת אפליקציית האימות" width={180} height={180} style={{ background: "#fff", borderRadius: 12, padding: 8 }} />
          <code className="gc-num t-caption" style={{ wordBreak: "break-all" }}>{qr.secret}</code>
        </div>
      )}
      {step === "code" && <p className="gc-muted">6 הספרות מאפליקציית האימות.</p>}
      <div className="otp" role="group" aria-label="קוד אימות">
        {code.map((c, i) => (
          <input key={i} ref={(el) => { boxes.current[i] = el; }} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={i === 0 ? 6 : 1} value={c} aria-label={`ספרה ${i + 1}`}
            onChange={(e) => onDigit(i, e.target.value)} onKeyDown={(e) => e.key === "Backspace" && !c && i > 0 && boxes.current[i - 1]?.focus()} />
        ))}
      </div>
      {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
      <button className="gc-btn gc-btn--ghost" onClick={() => { setStep("password"); setCode(["", "", "", "", "", ""]); setErr(""); }} disabled={busy}><Icon name="chevron-right" />חזרה</button>
    </div>
  );
}
