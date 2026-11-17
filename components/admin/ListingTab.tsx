"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "../Icon";
import { useToast } from "./Toast";
import { MoneyField } from "./MoneyField";
import { saveListing } from "@/app/admin/actions";
import { TAG, toAgorot } from "@/lib/format";
import type { Vehicle } from "@/lib/types";

const FIELDS: [string, string][] = [["year", "שנה"], ["km", "קילומטראז׳"], ["hand", "יד"], ["gearbox", "גיר"], ["engine_cc", "נפח מנוע"], ["fuel", "דלק"], ["test_valid_until", "טסט"], ["color", "צבע"]];

export function ListingTab({ v }: { v: Vehicle }) {
  const router = useRouter();
  const toast = useToast();
  const l = v.listing;
  const [pub, setPub] = useState(!!l?.is_published);
  const [text, setText] = useState(l?.marketing_text ?? "");
  const [sale, setSale] = useState(l?.sale_price ? String(l.sale_price / 100) : "");
  const [tags, setTags] = useState<string[]>(l?.tags ?? []);
  const [fields, setFields] = useState<string[]>(l?.visible_fields ?? FIELDS.map((f) => f[0]));
  const [pinned, setPinned] = useState(!!l?.pinned);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const tog = (arr: string[], k: string) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const save = (publish = pub) => start(async () => {
    setErr("");
    const r = await saveListing(v.id, { is_published: publish, marketing_text: text || null, sale_price: sale ? toAgorot(Number(sale)) : null, tags: sale && !tags.includes("sale") ? [...tags, "sale"] : tags, visible_fields: fields, pinned });
    if (!r.ok) { setPub(!!l?.is_published); return setErr(r.error); }
    setPub(publish);
    toast(publish ? "פורסם באתר" : "נשמר");
    router.refresh();
  });
  if (v.status === "sold") return <div className="alert alert--info"><Icon name="check" />הרכב נמכר והוסר מהאתר. קישורים ישנים מראים ״נמכר״ ורכבים דומים.</div>;
  return (
    <div className="gc-stack" style={{ gap: 16 }}>
      <section className="card row-between">
        <div className="gc-stack" style={{ gap: 2 }}><b>{pub ? "מפורסם באתר" : "לא מפורסם"}</b><span className="t-caption">{pub ? "מופיע בקטלוג ובחיפוש" : "רק אתם רואים אותו"}</span></div>
        <button className={`switch`} role="switch" aria-checked={pub} aria-label="פרסום באתר" disabled={pending} onClick={() => save(!pub)}><span /></button>
      </section>
      {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
      {pub && l?.slug && <a className="gc-btn gc-btn--outline gc-btn--block" href={`/cars/${l.slug}`} target="_blank" rel="noreferrer"><Icon name="globe" />צפייה בדף באתר</a>}
      <section className="card form">
        <MoneyField label="מחיר מבצע (ריק = בלי מבצע)" value={sale} onChange={setSale} />
        <div><span className="t-label">תגיות</span><div className="gc-chips" style={{ marginTop: 6, flexWrap: "wrap" }}>{Object.entries(TAG).filter(([k]) => k !== "new").map(([k, t]) => <button key={k} className="gc-chip" aria-pressed={tags.includes(k)} onClick={() => setTags(tog(tags, k))}>{t.label}</button>)}</div><span className="gc-field__hint">״חדש במגרש״ ו״יד ראשונה״ מתווספות לבד.</span></div>
        <label className="gc-field"><span className="gc-field__label">כמה מילים על הרכב</span><span className="gc-field__control"><textarea rows={4} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="למשל: יד ראשונה מפרטי, טיפולים בסוכנות, שמור מאוד" /></span><span className="gc-field__hint">{text.length}/600</span></label>
      </section>
      <section className="card form">
        <h2 className="t-heading">מה מוצג באתר</h2>
        <div className="gc-chips" style={{ flexWrap: "wrap" }}>{FIELDS.map(([k, n]) => <button key={k} className="gc-chip" aria-pressed={fields.includes(k)} onClick={() => setFields(tog(fields, k))}>{fields.includes(k) && <Icon name="check" size="sm" />}{n}</button>)}</div>
        <label className="gc-check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /><span>להציג ראשון בקטלוג ובדף הבית</span></label>
      </section>
      <div className="sticky-save"><button className="gc-btn gc-btn--primary gc-btn--block" onClick={() => save()} disabled={pending}>{pending ? "שומר…" : "שמירה"}</button></div>
    </div>
  );
}
