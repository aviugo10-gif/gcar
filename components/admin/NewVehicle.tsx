"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { useVault } from "./Vault";
import { useToast } from "./Toast";
import { MoneyField } from "./MoneyField";
import { plateLookup, createVehicle, ocrDocument } from "@/app/admin/actions";
import { compressImage } from "@/lib/image";
import { FUEL, GEARBOX, OWNERSHIP, plate as fmtPlate, toAgorot } from "@/lib/format";

type Gov = { make: string; model: string; trim: string | null; year: number | null; color: string | null; fuel: string | null; test_valid_until: string | null; ownership: string | null; ownership_flag: string | null; vin: string | null };

/** Plate → registry fills the car → the owner adds only km, hand and prices. About 20 seconds. */
export function NewVehicle() {
  const router = useRouter();
  const vault = useVault();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState<"" | "lookup" | "ocr" | "save">("");
  const [existing, setExisting] = useState<string | null>(null);
  const [form, setForm] = useState<Gov | null>(null);
  const [fromGov, setFromGov] = useState(false);
  const [kmV, setKm] = useState("");
  const [hand, setHand] = useState<number | null>(null);
  const [gearbox, setGearbox] = useState<string>("auto");
  const [listed, setListed] = useState("");
  const [purchase, setPurchase] = useState("");
  const [err, setErr] = useState("");
  const set = (k: keyof Gov, v: string | number | null) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function lookup(p = plate) {
    const n = p.replace(/\D/g, "");
    if (n.length < 5) return setErr("מספר רכב קצר מדי");
    setErr(""); setBusy("lookup"); setExisting(null);
    const r = await plateLookup(n);
    setBusy("");
    if (r.data?.existing) return setExisting(r.data.existing);
    const g = r.data?.gov;
    setFromGov(!!g);
    setForm(g ?? { make: "", model: "", trim: null, year: null, color: null, fuel: null, test_valid_until: null, ownership: null, ownership_flag: null, vin: null });
  }
  async function scan(f: File) {
    setBusy("ocr"); setErr("");
    const fd = new FormData();
    fd.set("image", new File([await compressImage(f)], "license.jpg", { type: "image/jpeg" }));
    fd.set("docType", "vehicle_license");
    const r = await ocrDocument(fd);
    setBusy("");
    if (!r.ok) return setErr(r.error);
    const p = r.data?.fields.plate?.replace(/\D/g, "") ?? "";
    setPlate(p);
    if (p) lookup(p);
  }
  async function save() {
    if (!form) return;
    if (!form.make || !form.model) return setErr("חסרים יצרן ודגם");
    setBusy("save"); setErr("");
    let purchase_price_enc: string | null = null;
    if (purchase) {
      if (!(await vault.ensure("הצפנת מחיר הקנייה"))) { setBusy(""); return; }
      purchase_price_enc = await vault.seal("purchase_price", toAgorot(Number(purchase)));
    }
    const r = await createVehicle({
      plate: plate.replace(/\D/g, ""), make: form.make, model: form.model, trim: form.trim, year: form.year, color: form.color,
      fuel: (form.fuel as never) ?? null, gearbox: gearbox as never, km: kmV ? Number(kmV) : null, hand, test_valid_until: form.test_valid_until,
      listed_price: listed ? toAgorot(Number(listed)) : null, purchase_price_enc, ownership_flags: form.ownership_flag ? [form.ownership_flag] : [],
    });
    setBusy("");
    if (!r.ok) return setErr(r.error);
    toast("הרכב נוסף. עכשיו תמונות");
    router.push(`/admin/inventory/${r.data!.id}?tab=photos`);
  }

  return (
    <div className="gc-stack" style={{ gap: 20 }}>
      <section className="gc-stack">
        <span className="t-label">מספר רכב</span>
        <form className="gc-plateinput" onSubmit={(e) => { e.preventDefault(); lookup(); }}>
          <span className="gc-plate__il">IL</span>
          <input value={fmtPlate(plate)} onChange={(e) => { setPlate(e.target.value.replace(/\D/g, "").slice(0, 8)); setForm(null); setExisting(null); }} inputMode="numeric" placeholder="12-345-67" aria-label="מספר רכב" autoFocus enterKeyHint="search" />
          <button type="button" className="gc-plateinput__scan" onClick={() => file.current?.click()} aria-label="צילום רישיון רכב"><Icon name="camera" /></button>
        </form>
        <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])} />
        {!form && !existing && <button className="gc-btn gc-btn--primary gc-btn--block" onClick={() => lookup()} disabled={!!busy || plate.length < 5}>{busy === "lookup" ? "מחפש במשרד התחבורה…" : busy === "ocr" ? "קורא את הרישיון…" : "חיפוש"}</button>}
        {!form && !existing && <p className="t-caption" style={{ textAlign: "center" }}>אפשר גם לצלם את רישיון הרכב. הפרטים יתמלאו לבד.</p>}
      </section>

      {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
      {existing && (
        <div className="alert alert--info"><Icon name="car" /><div className="gc-stack" style={{ gap: 8 }}>הרכב הזה כבר במערכת.<Link href={`/admin/inventory/${existing}`} className="gc-btn gc-btn--primary gc-btn--sm">לכרטיס הרכב</Link></div></div>
      )}

      {form && (
        <>
          <section className="card gc-stack">
            <div className="row-between"><h2 className="t-heading">{fromGov ? "מהמאגר הממשלתי" : "פרטי הרכב"}</h2>{fromGov && <span className="gc-tag gc-tag--first"><Icon name="shield-check" size="sm" />אומת</span>}</div>
            {!fromGov && <p className="gc-muted t-caption">לא מצאנו את הרכב במאגר. ממלאים ידנית.</p>}
            <div className="grid2">
              <Text label="יצרן" value={form.make} onChange={(v) => set("make", v)} />
              <Text label="דגם" value={form.model} onChange={(v) => set("model", v)} />
              <Text label="רמת גימור" value={form.trim ?? ""} onChange={(v) => set("trim", v || null)} />
              <Text label="שנה" value={form.year ? String(form.year) : ""} onChange={(v) => set("year", v ? Number(v.replace(/\D/g, "").slice(0, 4)) : null)} numeric />
              <Text label="צבע" value={form.color ?? ""} onChange={(v) => set("color", v || null)} />
              <label className="gc-field"><span className="gc-field__label">טסט בתוקף עד</span><span className="gc-field__control"><input type="date" value={form.test_valid_until ?? ""} onChange={(e) => set("test_valid_until", e.target.value || null)} /></span></label>
            </div>
            <div><span className="t-label">דלק</span><div className="gc-chips" style={{ marginTop: 6, flexWrap: "wrap" }}>{Object.entries(FUEL).map(([k, l]) => <button key={k} type="button" className="gc-chip" aria-pressed={form.fuel === k} onClick={() => set("fuel", k)}>{l}</button>)}</div></div>
            {form.ownership_flag && <div className="alert alert--warn"><Icon name="alert" /><span>בעלות קודמת: {OWNERSHIP[form.ownership_flag] ?? form.ownership}. יוצג לקונים בדף הרכב.</span></div>}
          </section>

          <section className="card gc-stack">
            <h2 className="t-heading">מה שרק אתם יודעים</h2>
            <label className="gc-field"><span className="gc-field__label">קילומטראז׳</span><span className="gc-field__control"><input inputMode="numeric" value={kmV ? Number(kmV).toLocaleString("he-IL") : ""} onChange={(e) => setKm(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="0" /><span className="gc-field__affix">ק״מ</span></span></label>
            <div><span className="t-label">יד</span><div className="gc-seg" role="tablist" style={{ marginTop: 6 }}>{[1, 2, 3, 4, 5].map((h) => <button key={h} type="button" role="tab" aria-selected={hand === h} onClick={() => setHand(h)}>{h === 5 ? "5+" : h}</button>)}</div></div>
            <div><span className="t-label">תיבת הילוכים</span><div className="gc-seg" role="tablist" style={{ marginTop: 6 }}>{Object.entries(GEARBOX).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={gearbox === k} onClick={() => setGearbox(k)}>{l}</button>)}</div></div>
            <MoneyField label="מחיר מבוקש באתר" value={listed} onChange={setListed} />
            <MoneyField label="מחיר קנייה" value={purchase} onChange={setPurchase} locked hint="מוצפן במכשיר. אף אחד לא רואה אותו בלי סיסמת הכספת." />
          </section>

          <button className="gc-btn gc-btn--primary gc-btn--block" onClick={save} disabled={busy === "save"}>{busy === "save" ? "שומר…" : "הוספה למלאי"}</button>
        </>
      )}
    </div>
  );
}

function Text({ label, value, onChange, numeric }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return <label className="gc-field"><span className="gc-field__label">{label}</span><span className="gc-field__control"><input value={value} onChange={(e) => onChange(e.target.value)} inputMode={numeric ? "numeric" : undefined} /></span></label>;
}
