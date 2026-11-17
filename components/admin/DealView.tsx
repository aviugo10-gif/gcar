"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { MoneyField } from "./MoneyField";
import { PayProgress } from "./PayProgress";
import { addPayment, markPaid, docUploadUrl, attachDoc, docViewUrl } from "@/app/admin/actions";
import { compressImage } from "@/lib/image";
import { money, date, phone as fmtPhone, plate as fmtPlate, PAY_METHOD, toAgorot } from "@/lib/format";
import { toWhatsApp } from "@/lib/il";
import type { Deal, Payment, DealDoc, DealBalance, Vehicle, Customer } from "@/lib/types";

const DOCS: [DealDoc["type"], string][] = [["agreement", "הסכם מכר"], ["disclosure", "גילוי נאות (חתום)"], ["receipt", "קבלה"], ["ownership_transfer", "העברת בעלות"], ["inspection", "בדיקת מכון"], ["car_book", "ספר רכב / רישיון"]];
const today = () => new Date().toISOString().slice(0, 10);

export function DealView({ deal, vehicle, customer, payments, docs, balance }: { deal: Deal; vehicle: Vehicle | null; customer: Customer | null; payments: Payment[]; docs: DealDoc[]; balance: DealBalance }) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [upType, setUpType] = useState<DealDoc["type"] | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const sorted = [...payments].sort((a, b) => a.due_date.localeCompare(b.due_date));

  async function toggle(p: Payment) {
    await markPaid(p.id, deal.id, !p.paid_at);
    toast(p.paid_at ? "סומן כלא שולם" : `התקבל ${money(p.amount)}`, async () => { await markPaid(p.id, deal.id, !!p.paid_at); router.refresh(); });
    router.refresh();
  }
  async function upload(f: File) {
    if (!upType) return;
    const isPdf = f.type === "application/pdf";
    const body = isPdf ? f : await compressImage(f, 2200, 0.85);
    const u = await docUploadUrl(deal.id, upType, isPdf ? "pdf" : "jpg");
    if (!u.ok) return toast("ההעלאה נכשלה");
    if (!u.data!.demo) {
      const r = await fetch(u.data!.url, { method: "PUT", headers: { "content-type": isPdf ? "application/pdf" : "image/jpeg" }, body });
      if (!r.ok) return toast("ההעלאה נכשלה");
    }
    await attachDoc(deal.id, upType, u.data!.path);
    toast("המסמך נשמר");
    setUpType(null);
    router.refresh();
  }
  async function view(d: DealDoc) {
    const r = await docViewUrl(d.path);
    if (r.ok && r.data!.url) window.open(r.data!.url, "_blank", "noopener");
    else toast("במצב הדגמה אין קובץ אמיתי");
  }

  return (
    <div className="gc-stack" style={{ gap: 16 }}>
      <section className="card gc-stack">
        <PayProgress b={balance} />
        <dl className="kv" style={{ marginTop: 8 }}>
          <dt>מחיר מכירה</dt><dd className="gc-num">{money(deal.sale_price)}</dd>
          {deal.trade_in_value ? <><dt>טרייד-אין</dt><dd className="gc-num">{money(deal.trade_in_value)}</dd></> : null}
          <dt>תאריך</dt><dd>{date(deal.deal_date)}</dd>
        </dl>
      </section>

      <div className="ios-list">
        {vehicle && <Link href={`/admin/inventory/${vehicle.id}`}><Icon name="car" /><span className="grow">{vehicle.make} {vehicle.model} {vehicle.year} <span className="t-caption">· {fmtPlate(vehicle.plate)}</span></span><Icon name="chevron-left" className="gc-faint" /></Link>}
        {customer && <Link href={`/admin/customers/${customer.id}`}><Icon name="users" /><span className="grow">{customer.full_name}</span><Icon name="chevron-left" className="gc-faint" /></Link>}
        {customer && <a href={`https://wa.me/${toWhatsApp(customer.phone)}`} target="_blank" rel="noreferrer"><Icon name="message-circle" /><span className="grow gc-num" dir="ltr" style={{ textAlign: "end" }}>{fmtPhone(customer.phone)}</span><span className="t-caption">וואטסאפ</span></a>}
      </div>

      <div className="row-between"><h2 className="group-title" style={{ margin: 0 }}>תשלומים</h2><button className="gc-btn gc-btn--ghost gc-btn--sm" onClick={() => setAdding(true)}><Icon name="plus" size="sm" />תשלום</button></div>
      <div className="ios-list">
        {sorted.map((p) => {
          const late = !p.paid_at && p.due_date < today();
          return (
            <div key={p.id}>
              <button className={`paycheck ${p.paid_at ? "on" : late ? "late" : ""}`} role="checkbox" aria-checked={!!p.paid_at} aria-label={p.paid_at ? "שולם, לחיצה לביטול" : "סימון כשולם"} onClick={() => toggle(p)}>{p.paid_at && <Icon name="check" size="sm" />}</button>
              <span className="grow" style={{ display: "flex", flexDirection: "column", padding: "8px 0" }}>
                <b style={{ fontWeight: 600 }}>{p.kind === "deposit" ? "מקדמה" : PAY_METHOD[p.method]}{p.check_number ? ` #${p.check_number}` : ""}</b>
                <span className={`t-caption ${late ? "neg" : ""}`}>{p.paid_at ? `התקבל ${date(p.paid_at, true)}` : late ? `באיחור, היה ל־${date(p.due_date, true)}` : `צפוי ${date(p.due_date, true)}`}</span>
              </span>
              <span className="gc-num" style={{ fontWeight: 600 }}>{money(p.amount)}</span>
            </div>
          );
        })}
        {!sorted.length && <div><span className="gc-muted">עוד אין תשלומים</span></div>}
      </div>

      <h2 className="group-title">מסמכים</h2>
      <div className="ios-list">
        {DOCS.map(([t, label]) => {
          const d = docs.find((x) => x.type === t);
          return (
            <div key={t} className="doc-slot" data-done={d ? "" : undefined}>
              <span className="doc-slot__ic"><Icon name={d ? "check" : "file-text"} size="sm" /></span>
              <span className="grow">{label}{d?.signed_at && <span className="t-caption"> · נחתם {date(d.signed_at, true)}</span>}</span>
              {d ? <button className="gc-btn gc-btn--ghost gc-btn--sm" onClick={() => view(d)}>צפייה</button> : <button className="gc-btn gc-btn--outline gc-btn--sm" onClick={() => { setUpType(t); setTimeout(() => file.current?.click(), 0); }}><Icon name="camera" size="sm" />צילום</button>}
            </div>
          );
        })}
      </div>
      <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <p className="t-caption">המסמכים נשמרים באחסון פרטי. קישור צפייה תקף לדקה אחת.</p>
      {deal.notes && <section className="card"><span className="t-label">הערות</span><p>{deal.notes}</p></section>}
      {adding && <AddPayment dealId={deal.id} outstanding={balance.outstanding} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddPayment({ dealId, outstanding, onClose }: { dealId: string; outstanding: number; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(outstanding > 0 ? String(Math.round(outstanding / 100)) : "");
  const [method, setMethod] = useState("check");
  const [due, setDue] = useState(today());
  const [paid, setPaid] = useState(false);
  const [check, setCheck] = useState("");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const total = toAgorot(Number(amount));
    const each = Math.floor(total / count);
    for (let i = 0; i < count; i++) {
      const d = new Date(due); d.setMonth(d.getMonth() + i);
      const amt = i === count - 1 ? total - each * (count - 1) : each;
      const r = await addPayment({ deal_id: dealId, amount: amt, method: method as never, due_date: d.toISOString().slice(0, 10), paid: paid && i === 0, check_number: check ? String(Number(check) + i) : null });
      if (!r.ok) { setBusy(false); return toast(r.error); }
    }
    toast(count > 1 ? `נוספו ${count} תשלומים` : "התשלום נוסף");
    onClose(); router.refresh();
  }
  return (
    <Sheet title="תשלום חדש" onClose={onClose} footer={<button className="gc-btn gc-btn--primary gc-btn--block" disabled={!amount || busy} onClick={save}>{busy ? "שומר…" : "שמירה"}</button>}>
      <div className="form">
        <MoneyField label={count > 1 ? "סכום כולל" : "סכום"} value={amount} onChange={setAmount} />
        <div className="gc-chips" style={{ flexWrap: "wrap" }}>{Object.entries(PAY_METHOD).map(([k, l]) => <button key={k} className="gc-chip" aria-pressed={method === k} onClick={() => setMethod(k)}>{l}</button>)}</div>
        <div className="grid2">
          <label className="gc-field"><span className="gc-field__label">{count > 1 ? "תשלום ראשון" : "תאריך"}</span><span className="gc-field__control"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></span></label>
          {method === "check" && <label className="gc-field"><span className="gc-field__label">מספר שיק</span><span className="gc-field__control"><input inputMode="numeric" value={check} onChange={(e) => setCheck(e.target.value.replace(/\D/g, ""))} /></span></label>}
        </div>
        {method === "check" && <div><span className="t-label">פריסה לשיקים חודשיים</span><div className="gc-seg" role="tablist" style={{ marginTop: 6 }}>{[1, 2, 3, 6, 12].map((n) => <button key={n} role="tab" aria-selected={count === n} onClick={() => setCount(n)}>{n === 1 ? "אחד" : n}</button>)}</div></div>}
        <label className="gc-check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /><span>{count > 1 ? "הראשון כבר התקבל" : "כבר התקבל"}</span></label>
      </div>
    </Sheet>
  );
}
