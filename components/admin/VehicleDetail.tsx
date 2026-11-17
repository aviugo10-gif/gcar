"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "../Icon";
import { PriceReveal } from "./PriceReveal";
import { Sheet } from "./Sheet";
import { MoneyField } from "./MoneyField";
import { StatusSheet } from "./InventoryList";
import { PhotosTab } from "./PhotosTab";
import { ExpensesTab } from "./ExpensesTab";
import { ListingTab } from "./ListingTab";
import { useVault } from "./Vault";
import { useToast } from "./Toast";
import { updateVehicle, saveEncPrices } from "@/app/admin/actions";
import { money, km, date, plate as fmtPlate, daysSince, daysTone, STATUS, OWNERSHIP, ACCIDENT, FUEL, GEARBOX, toAgorot } from "@/lib/format";
import { marginVat } from "@/lib/il";
import { PHOTO_BASE } from "@/lib/env";
import type { Vehicle, VehicleExpense, ExpenseCategory, Deal } from "@/lib/types";

type Props = { v: Vehicle; tab: string; expenses: VehicleExpense[]; categories: ExpenseCategory[]; suppliers: string[]; equipment: string[]; customers: { id: string; name: string }[]; deal: Deal | null; vatRate: number };
const TABS = [["overview", "סקירה"], ["details", "פרטים"], ["photos", "תמונות"], ["expenses", "הוצאות"], ["site", "באתר"]] as const;

export function VehicleDetail(p: Props) {
  const [tab, setTab] = useState(p.tab);
  useEffect(() => { const u = new URL(location.href); u.searchParams.set("tab", tab); history.replaceState(null, "", u); }, [tab]);
  return (
    <div className="gc-stack" style={{ gap: 16 }}>
      <div className="tabs-scroll"><div className="gc-seg" role="tablist" aria-label="חלקי כרטיס הרכב">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div></div>
      {tab === "overview" && <Overview {...p} go={setTab} />}
      {tab === "details" && <Details v={p.v} equipment={p.equipment} />}
      {tab === "photos" && <PhotosTab v={p.v} />}
      {tab === "expenses" && <ExpensesTab vehicleId={p.v.id} expenses={p.expenses} categories={p.categories} suppliers={p.suppliers} />}
      {tab === "site" && <ListingTab v={p.v} />}
    </div>
  );
}

function Overview({ v, expenses, customers, deal, vatRate, go }: Props & { go: (t: string) => void }) {
  const vault = useVault();
  const [status, setStatus] = useState(false);
  const [prices, setPrices] = useState(false);
  const [profit, setProfit] = useState<null | { purchase: number; price: number; exp: number; margin: number; vat: number; net: number; actual: boolean }>(null);
  const hideT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (!vault.unlocked) setProfit(null); }, [vault.unlocked]);
  useEffect(() => () => { if (hideT.current) clearTimeout(hideT.current); }, []);
  const main = v.photos.find((x) => x.is_main) ?? v.photos[0];
  const d = daysSince(v.stock_in_date);
  const exp = expenses.reduce((s, e) => s + e.amount, 0);
  const price = deal?.sale_price ?? v.listing?.sale_price ?? v.listed_price ?? 0;

  async function showProfit() {
    if (!v.purchase_price_enc) return;
    if (!(await vault.ensure("הצגת רווח"))) return;
    const purchase = await vault.open<number>("purchase_price", v.purchase_price_enc);
    // margin VAT is on (sale − purchase) only; repair costs are separate expenses with their own input VAT
    const { vat } = marginVat(price, purchase, vatRate);
    const margin = price - purchase - exp;
    setProfit({ purchase, price, exp, margin, vat, net: margin - vat, actual: !!deal });
    if (hideT.current) clearTimeout(hideT.current);
    hideT.current = setTimeout(() => setProfit(null), 30_000);
  }

  return (
    <>
      <div className="vhead">
        <div className="vhead__img">{main ? <img className="photo" src={PHOTO_BASE + main.path} alt="" /> : <button className="empty-photo" onClick={() => go("photos")}><Icon name="camera" size="lg" />הוספת תמונות</button>}</div>
        <div className="gc-stack">
          <div className="gc-row">
            <span className="gc-plate"><span className="gc-plate__il">IL</span><span className="gc-plate__num">{fmtPlate(v.plate)}</span></span>
            {v.status === "sold" ? <span className="gc-status gc-status--sold">נמכר</span> : <button className={`gc-status gc-status--${v.status} status-btn`} onClick={() => setStatus(true)}>{STATUS[v.status]}<Icon name="chevron-down" size="sm" /></button>}
            {v.listing?.is_published && <a className="gc-tag gc-tag--first" href={`/cars/${v.listing.slug}`} target="_blank" rel="noreferrer"><Icon name="globe" size="sm" />באתר</a>}
          </div>
          <dl className="kv">
            <dt>שנה</dt><dd>{v.year ?? "—"}</dd>
            <dt>קילומטראז׳</dt><dd className="gc-num">{km(v.km)}</dd>
            <dt>יד</dt><dd>{v.hand ?? "—"}</dd>
            {v.test_valid_until && <><dt>טסט עד</dt><dd>{date(v.test_valid_until)}</dd></>}
            <dt>במגרש</dt><dd className={daysTone(d) ? `gc-days--${daysTone(d)}` : ""}>{v.status === "sold" ? "—" : `${d} ימים (מ־${date(v.stock_in_date, true)})`}</dd>
            {v.ownership_flags.length > 0 && <><dt>בעלות קודמת</dt><dd>{v.ownership_flags.map((f) => OWNERSHIP[f] ?? f).join(", ")}</dd></>}
            {v.reserved_for && v.status === "reserved" && <><dt>שמור ל</dt><dd>{customers.find((c) => c.id === v.reserved_for)?.name ?? "—"} עד {date(v.reserved_until)}</dd></>}
          </dl>
        </div>
      </div>

      <section className="card gc-stack">
        <div className="row-between"><h2 className="t-heading">מחירים</h2><button className="gc-btn gc-btn--ghost gc-btn--sm" onClick={() => setPrices(true)}><Icon name="pencil" size="sm" />עריכה</button></div>
        <div className="row-between"><span className="t-label">מחיר באתר</span><span className="t-title-m gc-num">{money(v.listing?.sale_price ?? v.listed_price)}{v.listing?.sale_price && v.listed_price ? <span className="price-old">{money(v.listed_price)}</span> : null}</span></div>
        <PriceReveal label="מחיר קנייה" field="purchase_price" token={v.purchase_price_enc} />
        <PriceReveal label="מחיר מינימום" field="min_price" token={v.min_price_enc} />
      </section>

      <section className="card gc-stack">
        <div className="row-between"><h2 className="t-heading">{deal ? "רווח בפועל" : "רווח צפוי"}</h2><span className="t-caption">הוצאות על הרכב: <b className="gc-num">{money(exp)}</b></span></div>
        {profit ? (
          <div className="profit">
            <div className="row-between"><span className="t-label">{deal ? "מחיר מכירה" : "מחיר באתר"}</span><span className="gc-num">{money(profit.price)}</span></div>
            <div className="row-between"><span className="t-label">קנייה + הוצאות</span><span className="gc-num">− {money(profit.purchase + profit.exp)}</span></div>
            <div className="row-between"><span className="t-label">מע״מ עסקאות על המרווח ({vatRate}%)</span><span className="gc-num">− {money(profit.vat)}</span></div>
            <hr className="divider" style={{ margin: "4px 0" }} />
            <div className="row-between"><b>רווח נקי</b><b className={`t-title-m gc-num ${profit.net < 0 ? "neg" : "pos"}`}>{money(profit.net)}</b></div>
            {profit.price > 0 && <div className="bar"><span style={{ width: `${Math.max(0, Math.min(100, (profit.net / profit.price) * 100 * 4))}%` }} /></div>}
            <span className="t-caption">מוצג ל־30 שניות. המספרים פוענחו במכשיר הזה בלבד.</span>
          </div>
        ) : v.purchase_price_enc ? (
          <button className="gc-btn gc-btn--outline gc-btn--block" onClick={showProfit}><Icon name="eye" />הצגת רווח</button>
        ) : (
          <p className="gc-muted t-caption">כדי לחשב רווח צריך מחיר קנייה. <button className="link-btn" onClick={() => setPrices(true)}>הזנה</button></p>
        )}
      </section>

      <div className="quick-actions">
        {deal ? <Link href={`/admin/deals/${deal.id}`} className="qa"><Icon name="receipt" />לעסקה</Link> : <Link href={`/admin/deals/new?vehicle=${v.id}`} className="qa"><Icon name="receipt" />עסקה</Link>}
        <button className="qa" onClick={() => go("expenses")}><Icon name="wrench" />הוצאה</button>
        <button className="qa" onClick={() => go("photos")}><Icon name="camera" />תמונות</button>
        <button className="qa" onClick={() => go("site")}><Icon name="globe" />באתר</button>
      </div>

      {status && <StatusSheet v={{ id: v.id, title: `${v.make} ${v.model}`, status: v.status }} customers={customers} onClose={() => setStatus(false)} />}
      {prices && <PricesSheet v={v} onClose={() => setPrices(false)} />}
    </>
  );
}

function PricesSheet({ v, onClose }: { v: Vehicle; onClose: () => void }) {
  const vault = useVault();
  const toast = useToast();
  const router = useRouter();
  const [listed, setListed] = useState(v.listed_price ? String(v.listed_price / 100) : "");
  const [purchase, setPurchase] = useState("");
  const [min, setMin] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    if ((purchase || min) && !(await vault.ensure("הצפנת מחירים"))) return;
    const pe = purchase ? await vault.seal("purchase_price", toAgorot(Number(purchase))) : undefined;
    const me = min ? await vault.seal("min_price", toAgorot(Number(min))) : undefined;
    if (pe || me) await saveEncPrices(v.id, pe, me);
    if (listed !== (v.listed_price ? String(v.listed_price / 100) : "")) await updateVehicle(v.id, { listed_price: listed ? toAgorot(Number(listed)) : null });
    toast("המחירים נשמרו"); onClose(); router.refresh();
  });
  return (
    <Sheet title="עריכת מחירים" onClose={onClose} footer={<button className="gc-btn gc-btn--primary gc-btn--block" onClick={save} disabled={pending}>{pending ? "שומר…" : "שמירה"}</button>}>
      <div className="form">
        <MoneyField label="מחיר מבוקש באתר" value={listed} onChange={setListed} />
        <MoneyField label={v.purchase_price_enc ? "מחיר קנייה חדש (ריק = בלי שינוי)" : "מחיר קנייה"} value={purchase} onChange={setPurchase} locked />
        <MoneyField label={v.min_price_enc ? "מחיר מינימום חדש (ריק = בלי שינוי)" : "מחיר מינימום"} value={min} onChange={setMin} locked hint="מחיר הקנייה והמינימום מוצפנים לפני שהם יוצאים מהמכשיר." />
      </div>
    </Sheet>
  );
}

function Details({ v, equipment }: { v: Vehicle; equipment: string[] }) {
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState({ km: v.km ? String(v.km) : "", hand: v.hand, color: v.color ?? "", test: v.test_valid_until ?? "", cc: v.engine_cc ? String(v.engine_cc) : "", fuel: v.fuel ?? "", gearbox: v.gearbox ?? "", accident: v.accident, accident_notes: v.accident_notes ?? "", notes: v.notes ?? "", equipment: v.equipment });
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF((x) => ({ ...x, [k]: val }));
  const all = [...new Set([...equipment, ...v.equipment])];
  const save = () => start(async () => {
    const r = await updateVehicle(v.id, {
      km: f.km ? Number(f.km) : null, hand: f.hand, color: f.color || null, test_valid_until: f.test || null, engine_cc: f.cc ? Number(f.cc) : null,
      fuel: (f.fuel || null) as never, gearbox: (f.gearbox || null) as never, accident: f.accident, accident_notes: f.accident_notes || null, notes: f.notes || null, equipment: f.equipment,
    });
    if (!r.ok) return toast(r.error);
    toast("נשמר"); router.refresh();
  });
  return (
    <div className="gc-stack" style={{ gap: 16 }}>
      <section className="card form">
        <div className="grid2">
          <label className="gc-field"><span className="gc-field__label">קילומטראז׳</span><span className="gc-field__control"><input inputMode="numeric" value={f.km ? Number(f.km).toLocaleString("he-IL") : ""} onChange={(e) => set("km", e.target.value.replace(/\D/g, ""))} /></span></label>
          <label className="gc-field"><span className="gc-field__label">נפח מנוע</span><span className="gc-field__control"><input inputMode="numeric" value={f.cc} onChange={(e) => set("cc", e.target.value.replace(/\D/g, "").slice(0, 5))} /><span className="gc-field__affix">סמ״ק</span></span></label>
          <label className="gc-field"><span className="gc-field__label">צבע</span><span className="gc-field__control"><input value={f.color} onChange={(e) => set("color", e.target.value)} /></span></label>
          <label className="gc-field"><span className="gc-field__label">טסט עד</span><span className="gc-field__control"><input type="date" value={f.test} onChange={(e) => set("test", e.target.value)} /></span></label>
        </div>
        <div><span className="t-label">יד</span><div className="gc-seg" role="tablist" style={{ marginTop: 6 }}>{[1, 2, 3, 4, 5].map((h) => <button key={h} role="tab" aria-selected={f.hand === h} onClick={() => set("hand", h)}>{h === 5 ? "5+" : h}</button>)}</div></div>
        <div><span className="t-label">דלק</span><div className="gc-chips" style={{ marginTop: 6, flexWrap: "wrap" }}>{Object.entries(FUEL).map(([k, l]) => <button key={k} className="gc-chip" aria-pressed={f.fuel === k} onClick={() => set("fuel", k)}>{l}</button>)}</div></div>
        <div><span className="t-label">תיבת הילוכים</span><div className="gc-seg" role="tablist" style={{ marginTop: 6 }}>{Object.entries(GEARBOX).map(([k, l]) => <button key={k} role="tab" aria-selected={f.gearbox === k} onClick={() => set("gearbox", k)}>{l}</button>)}</div></div>
      </section>
      <section className="card form">
        <h2 className="t-heading">תאונות</h2>
        <div className="gc-chips" style={{ flexWrap: "wrap" }}>{Object.entries(ACCIDENT).map(([k, l]) => <button key={k} className="gc-chip" aria-pressed={f.accident === k} onClick={() => set("accident", k as Vehicle["accident"])}>{l}</button>)}</div>
        {f.accident !== "none" && <label className="gc-field"><span className="gc-field__label">מה קרה (יוצג לקונים)</span><span className="gc-field__control"><textarea rows={2} value={f.accident_notes} onChange={(e) => set("accident_notes", e.target.value)} /></span></label>}
      </section>
      <section className="card form">
        <h2 className="t-heading">אבזור</h2>
        <div className="gc-chips" style={{ flexWrap: "wrap" }}>{all.map((e) => <button key={e} className="gc-chip" aria-pressed={f.equipment.includes(e)} onClick={() => set("equipment", f.equipment.includes(e) ? f.equipment.filter((x) => x !== e) : [...f.equipment, e])}>{f.equipment.includes(e) && <Icon name="check" size="sm" />}{e}</button>)}</div>
      </section>
      <section className="card form">
        <label className="gc-field"><span className="gc-field__label">הערות פנימיות (לא באתר)</span><span className="gc-field__control"><textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></span></label>
      </section>
      <div className="sticky-save"><button className="gc-btn gc-btn--primary gc-btn--block" onClick={save} disabled={pending}>{pending ? "שומר…" : "שמירת פרטים"}</button></div>
    </div>
  );
}
