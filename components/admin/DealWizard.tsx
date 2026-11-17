"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../Icon";
import { useVault } from "./Vault";
import { useToast } from "./Toast";
import { MoneyField } from "./MoneyField";
import { CustomerSheet } from "./Customers";
import { createDeal } from "@/app/admin/actions";
import { money, plate as fmtPlate, phone as fmtPhone, PAY_METHOD, toAgorot } from "@/lib/format";

type V = { id: string; title: string; plate: string; price: number | null; min_enc: string | null; reserved_for: string | null };
type C = { id: string; name: string; phone: string };
const STEPS = ["רכב", "לקוח", "מחיר", "אישור"];

export function DealWizard({ vehicles, customers, initialVehicle, initialCustomer }: { vehicles: V[]; customers: C[]; initialVehicle?: string; initialCustomer?: string }) {
  const router = useRouter();
  const vault = useVault();
  const toast = useToast();
  const iv = vehicles.find((v) => v.id === initialVehicle);
  const [vid, setVid] = useState(iv?.id ?? "");
  const [cid, setCid] = useState(initialCustomer ?? iv?.reserved_for ?? "");
  const [extra, setExtra] = useState<C[]>([]);
  const [step, setStep] = useState(iv ? (initialCustomer || iv.reserved_for ? 2 : 1) : initialCustomer ? 0 : 0);
  const [q, setQ] = useState("");
  const [price, setPrice] = useState(iv?.price ? String(iv.price / 100) : "");
  const [tradeIn, setTradeIn] = useState("");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState("transfer");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [newCust, setNewCust] = useState(false);
  const [belowMin, setBelowMin] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const v = vehicles.find((x) => x.id === vid);
  const allC = [...extra, ...customers];
  const c = allC.find((x) => x.id === cid);
  const listV = useMemo(() => vehicles.filter((x) => !q || x.title.includes(q) || x.plate.includes(q.replace(/\D/g, "") || "~")), [vehicles, q]);
  const listC = useMemo(() => allC.filter((x) => !q || x.name.includes(q) || x.phone.includes(q.replace(/\D/g, "") || "~")), [allC, q]);

  // if the vault is open, warn (only here, only to you) when the price is under the car's minimum
  useEffect(() => {
    let off = false;
    (async () => {
      if (!v?.min_enc || !vault.unlocked || !price) return setBelowMin(null);
      const min = await vault.open<number>("min_price", v.min_enc);
      if (!off) setBelowMin(toAgorot(Number(price)) < min ? min : null);
    })();
    return () => { off = true; };
  }, [v, price, vault.unlocked, vault]);

  const go = (s: number) => { setQ(""); setStep(s); window.scrollTo({ top: 0 }); };
  async function submit() {
    if (!v || !c || !price) return;
    setBusy(true); setErr("");
    const r = await createDeal({ vehicle_id: v.id, customer_id: c.id, sale_price: toAgorot(Number(price)), deal_date: day, trade_in_value: tradeIn ? toAgorot(Number(tradeIn)) : null, notes: notes || null, deposit: deposit ? { amount: toAgorot(Number(deposit)), method: method as never } : null });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast("העסקה נפתחה. הרכב סומן כנמכר");
    router.push(`/admin/deals/${r.data!.id}`);
  }

  return (
    <div className="gc-stack" style={{ gap: 16 }}>
      <div className="gc-steps"><div className="gc-steps__bar">{STEPS.map((s, i) => <span key={s} data-done={i <= step ? "" : undefined} />)}</div><div className="gc-steps__label"><span>שלב {step + 1} מתוך {STEPS.length}</span><span>{STEPS[step]}</span></div></div>

      {step === 0 && (
        <>
          <label className="searchbar"><Icon name="search" className="gc-faint" /><input type="search" placeholder="דגם או לוחית" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש רכב" /></label>
          <div className="list">{listV.map((x) => (
            <button key={x.id} className="row-link pick" aria-pressed={vid === x.id} onClick={() => { setVid(x.id); setPrice(x.price ? String(x.price / 100) : ""); if (x.reserved_for && !cid) setCid(x.reserved_for); go(cid || x.reserved_for ? 2 : 1); }}>
              <span className="row-link__main"><span className="row-link__t">{x.title}</span><span className="row-link__s">{fmtPlate(x.plate)}{x.reserved_for ? " · שמור" : ""}</span></span>
              <span className="gc-num">{money(x.price)}</span>
            </button>
          ))}</div>
        </>
      )}

      {step === 1 && (
        <>
          <label className="searchbar"><Icon name="search" className="gc-faint" /><input type="search" placeholder="שם או טלפון" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש לקוח" /></label>
          <button className="gc-btn gc-btn--outline gc-btn--block" onClick={() => setNewCust(true)}><Icon name="plus" />לקוח חדש</button>
          <div className="list">{listC.map((x) => (
            <button key={x.id} className="row-link pick" aria-pressed={cid === x.id} onClick={() => { setCid(x.id); go(2); }}>
              <span className="avatar">{x.name[0]}</span><span className="row-link__main"><span className="row-link__t">{x.name}</span><span className="row-link__s gc-num" dir="ltr" style={{ textAlign: "end" }}>{fmtPhone(x.phone)}</span></span>
            </button>
          ))}</div>
          {newCust && <CustomerSheet onClose={() => setNewCust(false)} onCreated={(id, name) => { setExtra((e) => [{ id, name, phone: "" }, ...e]); setCid(id); go(2); }} />}
        </>
      )}

      {step === 2 && (
        <section className="card form">
          <Summary v={v} c={c} onV={() => go(0)} onC={() => go(1)} />
          <MoneyField label="מחיר מכירה" value={price} onChange={setPrice} />
          {belowMin !== null && <div className="alert alert--warn"><Icon name="alert" /><span>המחיר נמוך ממחיר המינימום שקבעתם ({money(belowMin)}). רק אתם רואים את זה.</span></div>}
          <MoneyField label="רכב בטרייד-אין (שווי, לא חובה)" value={tradeIn} onChange={setTradeIn} />
          <MoneyField label="מקדמה שהתקבלה היום" value={deposit} onChange={setDeposit} />
          {deposit && <div className="gc-chips" style={{ flexWrap: "wrap" }}>{Object.entries(PAY_METHOD).filter(([k]) => k !== "trade_in").map(([k, l]) => <button key={k} className="gc-chip" aria-pressed={method === k} onClick={() => setMethod(k)}>{l}</button>)}</div>}
          <label className="gc-field"><span className="gc-field__label">תאריך העסקה</span><span className="gc-field__control"><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></span></label>
          <button className="gc-btn gc-btn--primary gc-btn--block" disabled={!price} onClick={() => go(3)}>המשך</button>
        </section>
      )}

      {step === 3 && v && c && (
        <section className="card form">
          <Summary v={v} c={c} onV={() => go(0)} onC={() => go(1)} />
          <dl className="kv">
            <dt>מחיר מכירה</dt><dd className="gc-num"><b>{money(toAgorot(Number(price)))}</b></dd>
            {tradeIn && <><dt>טרייד-אין</dt><dd className="gc-num">{money(toAgorot(Number(tradeIn)))}</dd></>}
            {deposit && <><dt>מקדמה ({PAY_METHOD[method]})</dt><dd className="gc-num">{money(toAgorot(Number(deposit)))}</dd></>}
            <dt>יתרה לתשלום</dt><dd className="gc-num">{money(toAgorot(Number(price) - Number(deposit || 0) - Number(tradeIn || 0)))}</dd>
          </dl>
          <label className="gc-field"><span className="gc-field__label">הערות</span><span className="gc-field__control"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></span></label>
          <div className="alert alert--info"><Icon name="car" />פתיחת העסקה מסמנת את הרכב כנמכר ומורידה אותו מהאתר. את שאר התשלומים מוסיפים בדף העסקה.</div>
          {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
          <button className="gc-btn gc-btn--primary gc-btn--block" disabled={busy} onClick={submit}>{busy ? "פותח…" : "פתיחת עסקה"}</button>
          <button className="gc-btn gc-btn--ghost gc-btn--block" onClick={() => go(2)}>חזרה</button>
        </section>
      )}
    </div>
  );
}

function Summary({ v, c, onV, onC }: { v?: V; c?: C; onV: () => void; onC: () => void }) {
  return (
    <div className="ios-list" style={{ background: "var(--surface-sunken)" }}>
      <button className="ios-btn" onClick={onV}><Icon name="car" /><span className="grow">{v?.title ?? "בחירת רכב"}</span><span className="link-btn">שינוי</span></button>
      <button className="ios-btn" onClick={onC}><Icon name="users" /><span className="grow">{c?.name ?? "בחירת לקוח"}</span><span className="link-btn">שינוי</span></button>
    </div>
  );
}
