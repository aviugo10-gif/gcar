"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { isValidPhone } from "@/lib/il";

type Props = { kind: "vehicle" | "general" | "notify_me"; slug?: string; title?: string; submitLabel?: string; messageLabel?: string; initialMessage?: string; onDone?: React.ReactNode };

export function LeadForm({ kind, slug, submitLabel = "שליחה", messageLabel = "הערה (לא חובה)", initialMessage = "", onDone }: Props) {
  const opened = useRef(Date.now());
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState<Record<string, string>>({});
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      kind, slug, name: String(f.get("name") ?? ""), phone: String(f.get("phone") ?? ""), message: String(f.get("message") ?? "") || undefined,
      privacy: f.get("privacy") === "on", marketing: f.get("marketing") === "on", website: String(f.get("website") ?? ""), t: Date.now() - opened.current,
    };
    const errors: Record<string, string> = {};
    if (body.name.trim().length < 2) errors.name = "נא לכתוב שם";
    if (!isValidPhone(body.phone)) errors.phone = "מספר הטלפון לא שלם";
    if (!body.privacy) errors.privacy = "צריך לאשר את מדיניות הפרטיות כדי שנוכל לחזור אליכם";
    setErr(errors);
    if (Object.keys(errors).length) {
      (e.currentTarget.querySelector(`[name="${Object.keys(errors)[0]}"]`) as HTMLElement | null)?.focus();
      return;
    }
    setState("sending");
    const r = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setState(r?.ok ? "done" : "error");
  }
  if (state === "done")
    return onDone ?? (
      <div className="alert alert--ok" role="status"><Icon name="check" /><div><strong>קיבלנו, תודה.</strong><br />נחזור אליכם בהקדם בטלפון או בווצאפ.</div></div>
    );
  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className={`gc-field${err.name ? " gc-field--error" : ""}`}><span className="gc-field__label">שם</span>
        <span className="gc-field__control"><input name="name" autoComplete="name" required aria-invalid={!!err.name} aria-describedby={err.name ? "e-name" : undefined} /></span>
        {err.name && <span className="gc-field__hint" id="e-name">{err.name}</span>}
      </label>
      <label className={`gc-field${err.phone ? " gc-field--error" : ""}`}><span className="gc-field__label">טלפון</span>
        <span className="gc-field__control"><Icon name="phone" size="sm" /><input name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" style={{ textAlign: "right" }} required aria-invalid={!!err.phone} aria-describedby={err.phone ? "e-phone" : undefined} /></span>
        {err.phone && <span className="gc-field__hint" id="e-phone">{err.phone}</span>}
      </label>
      <label className="gc-field"><span className="gc-field__label">{messageLabel}</span>
        <span className="gc-field__control"><textarea name="message" rows={2} defaultValue={initialMessage} maxLength={1000} /></span>
      </label>
      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="gc-check"><input type="checkbox" name="privacy" aria-invalid={!!err.privacy} aria-describedby={err.privacy ? "e-priv" : undefined} />
        <span>קראתי ואני מסכים/ה <Link href="/privacy" target="_blank">למדיניות הפרטיות</Link> ולשמירת הפרטים כדי שיחזרו אליי</span>
      </label>
      {err.privacy && <span className="gc-field__hint" id="e-priv" style={{ color: "var(--danger)" }}>{err.privacy}</span>}
      <label className="gc-check"><input type="checkbox" name="marketing" /><span>אשמח לקבל עדכונים על רכבים חדשים (לא חובה)</span></label>
      {state === "error" && <div className="alert alert--danger" role="alert"><Icon name="alert" />השליחה לא הצליחה. אפשר לנסות שוב או לכתוב לנו בווצאפ.</div>}
      <button className="gc-btn gc-btn--primary gc-btn--block" disabled={state === "sending"}>{state === "sending" ? "שולח…" : submitLabel}</button>
    </form>
  );
}
