"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { isValidPhone } from "@/lib/il";
import { compressImage } from "@/lib/image";
import { waLink } from "@/lib/wa";
import type { ScrapPromise } from "@/lib/promise";

const QUESTIONS: [string, string][] = [
  ["starts", "הרכב מתניע?"], ["drives", "הרכב נוסע?"], ["keys", "יש מפתחות?"], ["accident", "הרכב עבר תאונה?"],
  ["fire_flood", "נזק אש או הצפה?"], ["missing_parts", "חסרים חלקים?"], ["airbags", "כריות אוויר נפתחו?"], ["lien", "יש שעבוד או עיקול?"],
];
const SHOTS = ["חזית", "אחור", "צד", "פנים", "מד ק״מ", "נזק"];
const STEPS = ["הרכב", "מצב", "תמונות", "פרטי קשר"];
type Draft = { plate: string; make: string; model: string; year: string; km: string; answers: Record<string, string>; city: string; name: string; phone: string; contact_pref: "call" | "whatsapp" };
const EMPTY: Draft = { plate: "", make: "", model: "", year: "", km: "", answers: {}, city: "", name: "", phone: "", contact_pref: "whatsapp" };
const KEY = "gc-scrap-draft";

export function ScrapForm({ promise, phone }: { promise: ScrapPromise; phone: string }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [lookup, setLookup] = useState<"idle" | "loading" | "found" | "none">("idle");
  const [photos, setPhotos] = useState<{ label: string; url: string; path?: string }[]>([]);
  const [privacy, setPrivacy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState<ScrapPromise | null>(null);
  const [busy, setBusy] = useState(false);
  const opened = useRef(Date.now());
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setD({ ...EMPTY, ...JSON.parse(s) }); } catch { /* */ } }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* */ } }, [d]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((o) => ({ ...o, [k]: v }));

  async function findPlate() {
    const p = d.plate.replace(/\D/g, "");
    if (p.length < 7) return setErr("מספר רישוי הוא 7 או 8 ספרות");
    setErr(""); setLookup("loading");
    const r = await fetch(`/api/plate?plate=${p}`).then((x) => x.json()).catch(() => null);
    if (r?.found) { setD((o) => ({ ...o, make: r.vehicle.make, model: r.vehicle.model, year: String(r.vehicle.year ?? "") })); setLookup("found"); }
    else setLookup("none");
  }
  function next() {
    setErr("");
    if (step === 0 && (!d.make || !d.model)) return setErr("נא למלא יצרן ודגם, או לחפש לפי מספר רישוי");
    if (step === 1 && QUESTIONS.some(([k]) => !d.answers[k])) return setErr("נא לענות על כל השאלות. אפשר לבחור ״לא יודע״");
    setStep((s) => s + 1);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function addPhoto(label: string, file?: File) {
    if (!file) return;
    const blob = await compressImage(file);
    const url = URL.createObjectURL(blob);
    let path: string | undefined;
    const up = await fetch("/api/scrap/upload", { method: "POST" }).then((r) => r.json()).catch(() => null);
    if (up?.url) { const put = await fetch(up.url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: blob }).catch(() => null); if (put?.ok) path = up.path; }
    setPhotos((ps) => [...ps.filter((p) => p.label !== label), { label, url, path }]);
  }
  async function submit() {
    setErr("");
    if (d.city.trim().length < 2) return setErr("נא לכתוב יישוב");
    if (d.name.trim().length < 2) return setErr("נא לכתוב שם");
    if (!isValidPhone(d.phone)) return setErr("מספר הטלפון לא שלם");
    if (!privacy) return setErr("צריך לאשר את מדיניות הפרטיות כדי שנוכל לשלוח הצעה");
    setBusy(true);
    const body = {
      plate: d.plate.replace(/\D/g, "") || undefined, make: d.make || undefined, model: d.model || undefined,
      year: d.year ? Number(d.year) : undefined, km: d.km ? Number(d.km.replace(/\D/g, "")) : undefined,
      answers: d.answers, photos: photos.map((p) => p.path).filter(Boolean), city: d.city, name: d.name, phone: d.phone,
      contact_pref: d.contact_pref, privacy: true, website: (document.getElementById("scrap-hp") as HTMLInputElement)?.value ?? "", t: Date.now() - opened.current,
    };
    const r = await fetch("/api/scrap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setErr(r?.status === 429 ? "נשלחו כבר כמה פניות מהמכשיר הזה. נסו שוב בעוד כמה דקות או כתבו לנו בווצאפ." : "השליחה לא הצליחה. נסו שוב או כתבו לנו בווצאפ.");
    const j = await r.json();
    try { localStorage.removeItem(KEY); } catch { /* */ }
    setSent(j.promise ?? promise);
  }

  if (sent)
    return (
      <div className="gc-stack" style={{ gap: 20 }} role="status">
        <div className="gc-empty" style={{ padding: "16px 0" }}>
          <div className="gc-empty__ic" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}><Icon name="check" size="lg" /></div>
          <h2 className="gc-empty__title">קיבלנו את הפרטים</h2>
          <p className="gc-empty__text">{sent.kind === "minutes" ? "הצעת מחיר בדרך אליכם, בדרך כלל תוך דקות." : sent.text + "."}</p>
          <a className="gc-btn gc-btn--whatsapp" href={waLink(phone)} target="_blank" rel="noopener"><Icon name="message-circle" />רוצים לזרז? כתבו לנו</a>
        </div>
        <div className="card card--flat gc-stack">
          <h3 className="t-title-m">מה להכין ליום האיסוף</h3>
          <ul className="gc-stack" style={{ margin: 0, paddingInlineStart: 20 }}>
            <li>רישיון הרכב</li><li>תעודת זהות של הבעלים הרשום</li><li>כל המפתחות</li><li>ייפוי כוח, אם מישהו אחר מגיע במקום הבעלים</li>
          </ul>
        </div>
      </div>
    );

  return (
    <div className="gc-stack" style={{ gap: 20 }} ref={top}>
      <div className="gc-steps">
        <div className="gc-steps__label"><span>שלב {step + 1} מתוך 4 · {STEPS[step]}</span><span>{["עוד כ־2 דקות", "עוד כדקה וחצי", "עוד כדקה", "כמעט סיימנו"][step]}</span></div>
        <div className="gc-steps__bar" aria-hidden="true">{STEPS.map((s, i) => <span key={s} data-done={i <= step ? "" : undefined} />)}</div>
      </div>

      {step === 0 && (
        <div className="form">
          <div className="gc-field">
            <span className="gc-field__label" id="pl">מספר רישוי</span>
            <div className="gc-plateinput"><span className="gc-plate__il">IL</span>
              <input inputMode="numeric" placeholder="000-00-000" aria-labelledby="pl" value={d.plate} onChange={(e) => { set("plate", e.target.value.replace(/[^\d-]/g, "")); setLookup("idle"); }} onKeyDown={(e) => e.key === "Enter" && findPlate()} />
              <button className="gc-plateinput__scan" onClick={findPlate} aria-label="חיפוש לפי מספר רישוי" type="button">{lookup === "loading" ? "…" : <Icon name="search" size="lg" />}</button>
            </div>
            <span className="gc-field__hint">ממלא אוטומטית יצרן, דגם ושנה ממאגר משרד התחבורה.</span>
          </div>
          {lookup === "found" && <div className="alert alert--ok"><Icon name="check" /><div>זה הרכב שלכם? <strong>{d.make} {d.model} {d.year}</strong>. אם לא, אפשר לתקן למטה.</div></div>}
          {lookup === "none" && <div className="alert alert--info"><Icon name="alert" />לא מצאנו את המספר במאגר. אפשר למלא ידנית.</div>}
          <div className="range">
            <label className="gc-field"><span className="gc-field__label">יצרן</span><span className="gc-field__control"><input value={d.make} onChange={(e) => set("make", e.target.value)} /></span></label>
            <label className="gc-field"><span className="gc-field__label">דגם</span><span className="gc-field__control"><input value={d.model} onChange={(e) => set("model", e.target.value)} /></span></label>
            <label className="gc-field"><span className="gc-field__label">שנה</span><span className="gc-field__control"><input inputMode="numeric" dir="ltr" style={{ textAlign: "right" }} value={d.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, "").slice(0, 4))} /></span></label>
            <label className="gc-field"><span className="gc-field__label">ק״מ משוער</span><span className="gc-field__control"><input inputMode="numeric" dir="ltr" style={{ textAlign: "right" }} value={d.km} onChange={(e) => set("km", e.target.value.replace(/\D/g, ""))} /></span></label>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          {QUESTIONS.map(([k, q]) => (
            <div key={k} className="q" role="radiogroup" aria-label={q}>
              <span className="q__label">{q}</span>
              <div className="gc-seg">{["כן", "לא", "לא יודע"].map((a) => <button key={a} type="button" role="radio" aria-checked={d.answers[k] === a} aria-selected={d.answers[k] === a} onClick={() => set("answers", { ...d.answers, [k]: a })}>{a}</button>)}</div>
            </div>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="gc-stack">
          <p className="gc-muted">לא חובה, אבל עם תמונות ההצעה מדויקת יותר. התמונות נשלחות רק אלינו.</p>
          <div className="shots">
            {SHOTS.map((s) => {
              const p = photos.find((x) => x.label === s);
              return (
                <label key={s} className="shot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p ? <img src={p.url} alt={s} /> : <><Icon name="camera" />{s}</>}
                  <input type="file" accept="image/*" capture="environment" className="gc-sr" onChange={(e) => addPhoto(s, e.target.files?.[0])} aria-label={`צילום ${s}`} />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="form">
          <label className="gc-field"><span className="gc-field__label">יישוב</span><span className="gc-field__control"><Icon name="map-pin" size="sm" /><input autoComplete="address-level2" value={d.city} onChange={(e) => set("city", e.target.value)} /></span></label>
          <label className="gc-field"><span className="gc-field__label">שם</span><span className="gc-field__control"><input autoComplete="name" value={d.name} onChange={(e) => set("name", e.target.value)} /></span></label>
          <label className="gc-field"><span className="gc-field__label">טלפון</span><span className="gc-field__control"><Icon name="phone" size="sm" /><input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" style={{ textAlign: "right" }} value={d.phone} onChange={(e) => set("phone", e.target.value)} /></span></label>
          <div className="gc-field"><span className="gc-field__label">איך נוח שנחזור?</span>
            <div className="gc-seg" role="radiogroup">{([["whatsapp", "ווצאפ"], ["call", "שיחה"]] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={d.contact_pref === v} aria-selected={d.contact_pref === v} onClick={() => set("contact_pref", v)}>{l}</button>)}</div>
          </div>
          <input id="scrap-hp" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <label className="gc-check"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /><span>קראתי ואני מסכים/ה <Link href="/privacy" target="_blank">למדיניות הפרטיות</Link> ולשמירת הפרטים לצורך הצעת מחיר</span></label>
        </div>
      )}

      {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
      <div className="gc-row" style={{ flexWrap: "nowrap" }}>
        {step > 0 && <button type="button" className="gc-btn gc-btn--outline" onClick={() => { setErr(""); setStep((s) => s - 1); }}><Icon name="chevron-right" />חזרה</button>}
        {step < 3 ? (
          <button type="button" className="gc-btn gc-btn--primary" style={{ flex: 1 }} onClick={next}>{step === 2 && !photos.length ? "דילוג" : "המשך"}<Icon name="chevron-left" /></button>
        ) : (
          <button type="button" className="gc-btn gc-btn--primary" style={{ flex: 1 }} onClick={submit} disabled={busy}>{busy ? "שולח…" : "שליחה וקבלת הצעה"}</button>
        )}
      </div>
    </div>
  );
}
