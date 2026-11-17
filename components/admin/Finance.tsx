"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import { useVault } from "./Vault";
import { useToast } from "./Toast";
import { Sheet } from "./Sheet";
import { MoneyField } from "./MoneyField";
import { financeRows, addFinanceRow } from "@/app/admin/actions";
import { supabaseBrowser } from "@/lib/supabase/client";
import { marginVat } from "@/lib/il";
import { money, date, toAgorot } from "@/lib/format";
import type { BusinessExpensePayload, IncomePayload } from "@/lib/types";

type Raw = Awaited<ReturnType<typeof financeRows>>;
type DealRow = { id: string; title: string; date: string; sale: number; purchase: number; exp: number; vat: number; net: number; days: number };
type Data = { deals: DealRow[]; be: (BusinessExpensePayload & { month: string })[]; oi: (IncomePayload & { month: string })[]; stockCost: number; stockCount: number; missingPurchase: number };
const PERIODS = [["m", "החודש"], ["q", "3 חודשים"], ["y", "השנה"], ["all", "הכול"]] as const;
const monthKey = (d: string) => d.slice(0, 7);
const HE_MONTH = (k: string) => new Date(k + "-01T12:00:00").toLocaleDateString("he-IL", { month: "short" });

/** Everything here is decrypted in this browser only, after the vault password AND a fresh authenticator code. */
export function Finance({ vatRate, demo }: { vatRate: number; demo: boolean }) {
  const vault = useVault();
  const [otpOk, setOtpOk] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (!vault.unlocked) { setData(null); setOtpOk(false); } }, [vault.unlocked]);

  async function load() {
    setErr("");
    try {
      const raw = await financeRows();
      setData(await decrypt(raw));
    } catch { setErr("נדרש קוד אימות חדש"); setOtpOk(false); }
  }
  async function decrypt(r: Raw): Promise<Data> {
    const deals: DealRow[] = [];
    let missing = 0;
    for (const d of r.deals) {
      const v = r.vehicles.find((x) => x.id === d.vehicle_id);
      const exp = r.expenses.filter((e) => e.vehicle_id === d.vehicle_id).reduce((s, e) => s + e.amount, 0);
      const purchase = v?.purchase_price_enc ? await vault.open<number>("purchase_price", v.purchase_price_enc) : 0;
      if (!v?.purchase_price_enc) missing++;
      const { vat } = marginVat(d.sale_price, purchase, vatRate);
      deals.push({ id: d.id, title: v?.title ?? "רכב", date: d.deal_date, sale: d.sale_price, purchase, exp, vat, net: d.sale_price - purchase - exp - vat, days: v ? Math.max(0, Math.round((Date.parse(d.deal_date) - Date.parse(v.stock_in_date)) / 86_400_000)) : 0 });
    }
    let stockCost = 0;
    const stock = r.vehicles.filter((v) => v.status !== "sold");
    for (const v of stock) {
      if (v.purchase_price_enc) stockCost += await vault.open<number>("purchase_price", v.purchase_price_enc);
      stockCost += r.expenses.filter((e) => e.vehicle_id === v.id).reduce((s, e) => s + e.amount, 0);
    }
    const be = await Promise.all(r.business_expenses.map(async (x) => ({ ...(await vault.open<BusinessExpensePayload>("business_expense", x.payload_enc)), month: x.month })));
    const oi = await Promise.all(r.other_income.map(async (x) => ({ ...(await vault.open<IncomePayload>("other_income", x.payload_enc)), month: x.month })));
    return { deals, be, oi, stockCost, stockCount: stock.length, missingPurchase: missing };
  }

  if (!vault.unlocked || !otpOk) return <Gate demo={demo} onDone={() => { setOtpOk(true); load(); }} />;
  if (err) return <div className="alert alert--danger"><Icon name="alert" />{err}</div>;
  if (!data) return <p className="gc-muted">מפענח במכשיר…</p>;
  return <Report d={data} vatRate={vatRate} reload={load} />;
}

function Gate({ demo, onDone }: { demo: boolean; onDone: () => void }) {
  const vault = useVault();
  const [step, setStep] = useState<"vault" | "otp">(vault.unlocked ? "otp" : "vault");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (step === "otp") input.current?.focus(); }, [step]);
  async function verify(c: string) {
    setBusy(true); setErr("");
    if (!demo) {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.mfa.listFactors();
      const f = data?.totp?.find((x: { status: string }) => x.status === "verified");
      const r = f ? await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: c }) : { error: new Error("no factor") };
      if (r.error) { setBusy(false); setCode(""); return setErr("הקוד לא נכון או שפג תוקפו"); }
    }
    setBusy(false);
    onDone();
  }
  return (
    <div className="login" style={{ minHeight: "60dvh" }}>
      <div className="card login__card gc-stack" style={{ gap: 16, textAlign: "center" }}>
        <span className="gc-empty__ic" style={{ margin: "0 auto" }}><Icon name="lock" size="lg" /></span>
        <h2 className="t-title-l">כספים</h2>
        <p className="gc-muted">שני מנעולים: סיסמת הכספת שפותחת את ההצפנה במכשיר, וקוד חדש מאפליקציית האימות.</p>
        <div className="gc-steps__bar"><span data-done="" /><span data-done={step === "otp" ? "" : undefined} /></div>
        {step === "vault" ? (
          <button className="gc-btn gc-btn--primary gc-btn--block" onClick={async () => { if (await vault.ensure("סיסמת הכספת")) setStep("otp"); }}><Icon name="key" />פתיחת הכספת</button>
        ) : (
          <>
            <label className="t-label" htmlFor="otp">קוד מאפליקציית האימות</label>
            <input id="otp" ref={input} className="otp-single gc-num" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy}
              onChange={(e) => { const c = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(c); if (c.length === 6) verify(c); }} placeholder="••••••" />
            {demo && <span className="t-caption">מצב הדגמה: כל 6 ספרות</span>}
          </>
        )}
        {err && <div className="alert alert--danger" role="alert"><Icon name="alert" />{err}</div>}
      </div>
    </div>
  );
}

function Report({ d, vatRate, reload }: { d: Data; vatRate: number; reload: () => void }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("q");
  const [adding, setAdding] = useState<null | "business_expenses" | "other_income">(null);
  const now = new Date();
  const from = period === "m" ? new Date(now.getFullYear(), now.getMonth(), 1) : period === "q" ? new Date(now.getFullYear(), now.getMonth() - 2, 1) : period === "y" ? new Date(now.getFullYear(), 0, 1) : new Date(2000, 0, 1);
  const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
  const inP = (k: string) => monthKey(k) >= fromKey;
  const deals = d.deals.filter((x) => inP(x.date));
  const be = d.be.filter((x) => inP(x.month));
  const oi = d.oi.filter((x) => inP(x.month));
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
  const k = { sales: sum(deals, (x) => x.sale), carNet: sum(deals, (x) => x.net), vat: sum(deals, (x) => x.vat), be: sum(be, (x) => x.amount), oi: sum(oi, (x) => x.amount) };
  const net = k.carNet + k.oi - k.be;

  const months = useMemo(() => {
    const keys: string[] = [];
    const start = period === "all" ? [...d.deals.map((x) => x.date), ...d.be.map((x) => x.month)].sort()[0]?.slice(0, 7) ?? fromKey : fromKey;
    const c = new Date(start + "-01T12:00:00");
    while (keys.length < 24 && `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}` <= monthKey(now.toISOString())) { keys.push(`${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`); c.setMonth(c.getMonth() + 1); }
    return keys.map((m) => ({ m, net: sum(d.deals.filter((x) => monthKey(x.date) === m), (x) => x.net) + sum(d.oi.filter((x) => monthKey(x.month) === m), (x) => x.amount) - sum(d.be.filter((x) => monthKey(x.month) === m), (x) => x.amount) }));
  }, [d, period]); // eslint-disable-line react-hooks/exhaustive-deps

  function exportCsv() {
    const rows = [["סוג", "תאריך", "תיאור", "מכירה", "קנייה", "הוצאות", `מע״מ מרווח ${vatRate}%`, "רווח נקי"]];
    for (const x of deals) rows.push(["עסקה", x.date, x.title, ...[x.sale, x.purchase, x.exp, x.vat, x.net].map((n) => (n / 100).toFixed(2))]);
    for (const x of be) rows.push(["הוצאה עסקית", x.month, x.category + (x.note ? ` (${x.note})` : ""), "", "", (x.amount / 100).toFixed(2), x.vat ? (x.vat / 100).toFixed(2) : "", (-x.amount / 100).toFixed(2)]);
    for (const x of oi) rows.push(["הכנסה אחרת", x.month, x.category, (x.amount / 100).toFixed(2), "", "", "", (x.amount / 100).toFixed(2)]);
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `gcar-כספים-${fromKey}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="gc-stack finance" style={{ gap: 16 }}>
      <div className="row-between no-print" style={{ flexWrap: "wrap" }}>
        <div className="gc-seg" role="tablist" style={{ flex: "1 1 320px" }}>{PERIODS.map(([p, l]) => <button key={p} role="tab" aria-selected={period === p} onClick={() => setPeriod(p)}>{l}</button>)}</div>
        <div className="gc-row"><button className="gc-btn gc-btn--outline gc-btn--sm" onClick={exportCsv}><Icon name="download" size="sm" />Excel</button><button className="gc-btn gc-btn--outline gc-btn--sm" onClick={() => window.print()}><Icon name="file-text" size="sm" />PDF</button></div>
      </div>
      <h2 className="print-only t-title-l">gcar · דוח כספי מ־{fromKey}</h2>
      <div className="kpis">
        <div className="gc-stat gc-stat--ink"><span className="gc-stat__label">רווח נקי</span><span className="gc-stat__value gc-num">{money(net)}</span><span className="gc-stat__delta">אחרי מע״מ והוצאות</span></div>
        <div className="gc-stat"><span className="gc-stat__label">מכירות ({deals.length})</span><span className="gc-stat__value gc-num">{money(k.sales)}</span></div>
        <div className="gc-stat"><span className="gc-stat__label">מע״מ על המרווח</span><span className="gc-stat__value gc-num">{money(k.vat)}</span><span className="gc-stat__delta">לדיווח</span></div>
        <div className="gc-stat"><span className="gc-stat__label">כסף במלאי ({d.stockCount})</span><span className="gc-stat__value gc-num">{money(d.stockCost)}</span><span className="gc-stat__delta">קנייה + הוצאות</span></div>
      </div>
      {d.missingPurchase > 0 && <div className="alert alert--warn"><Icon name="alert" /><span>ל־{d.missingPurchase} עסקאות אין מחיר קנייה, הרווח שלהן מחושב כאילו הקנייה הייתה 0.</span></div>}

      <section className="card gc-stack">
        <h2 className="t-heading">רווח נקי לפי חודש</h2>
        <BarChart rows={months.map((x) => ({ label: HE_MONTH(x.m), value: x.net, key: x.m }))} />
      </section>

      <section className="card gc-stack">
        <div className="row-between"><h2 className="t-heading">רווח לפי רכב</h2><span className="t-caption">ימים במגרש עד המכירה</span></div>
        {deals.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>רכב</th><th className="n">מכירה</th><th className="n">קנייה</th><th className="n">הוצאות</th><th className="n">מע״מ</th><th className="n">נקי</th><th className="n">ימים</th></tr></thead>
            <tbody>{deals.map((x) => <tr key={x.id}><td>{x.title}<div className="t-caption">{date(x.date, true)}</div></td><td className="n">{money(x.sale)}</td><td className="n">{money(x.purchase)}</td><td className="n">{money(x.exp)}</td><td className="n">{money(x.vat)}</td><td className={`n ${x.net < 0 ? "neg" : ""}`}><b>{money(x.net)}</b></td><td className="n">{x.days}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="gc-muted">אין עסקאות בתקופה.</p>}
      </section>

      <div className="grid-2col">
        <section className="card gc-stack">
          <div className="row-between"><h2 className="t-heading">הוצאות העסק</h2><button className="gc-btn gc-btn--ghost gc-btn--sm no-print" onClick={() => setAdding("business_expenses")}><Icon name="plus" size="sm" />הוספה</button></div>
          <Grouped rows={be} />
          <div className="row-between"><b>סה״כ</b><b className="gc-num">{money(k.be)}</b></div>
        </section>
        <section className="card gc-stack">
          <div className="row-between"><h2 className="t-heading">הכנסות נוספות</h2><button className="gc-btn gc-btn--ghost gc-btn--sm no-print" onClick={() => setAdding("other_income")}><Icon name="plus" size="sm" />הוספה</button></div>
          <Grouped rows={oi} />
          <div className="row-between"><b>סה״כ</b><b className="gc-num">{money(k.oi)}</b></div>
        </section>
      </div>
      <p className="t-caption">מע״מ מחושב לפי שיטת המרווח: (מכירה פחות קנייה) × {vatRate}/{100 + vatRate}. הפסד = 0 מע״מ. זה כלי עזר; הדיווח הרשמי דרך רו״ח.</p>
      {adding && <AddRow table={adding} onClose={() => setAdding(null)} onSaved={reload} />}
    </div>
  );
}

function Grouped({ rows }: { rows: { category: string; amount: number }[] }) {
  const g = Object.entries(rows.reduce<Record<string, number>>((a, x) => ((a[x.category] = (a[x.category] ?? 0) + x.amount), a), {})).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...g.map((x) => x[1]));
  if (!g.length) return <p className="gc-muted">אין רשומות בתקופה.</p>;
  return <div className="gc-stack" style={{ gap: 10 }}>{g.map(([c, v]) => <div key={c} className="gc-stack" style={{ gap: 4 }}><div className="row-between"><span>{c}</span><span className="gc-num">{money(v)}</span></div><div className="bar"><span style={{ width: `${(v / max) * 100}%`, background: "var(--ink-2)" }} /></div></div>)}</div>;
}

/** Single series, one axis, zero baseline; hover/focus shows the exact value. Negative months drop below the line. */
function BarChart({ rows }: { rows: { label: string; value: number; key: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, pad = { t: 16, b: 28, s: 8 };
  const max = Math.max(1, ...rows.map((r) => r.value)), min = Math.min(0, ...rows.map((r) => r.value));
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const bw = (W - pad.s * 2) / Math.max(1, rows.length);
  const barW = Math.min(44, bw * 0.6);
  if (!rows.length) return <p className="gc-muted">אין נתונים.</p>;
  return (
    <div style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="רווח נקי לפי חודש" style={{ direction: "ltr" }}>
        {[max, max / 2, 0, min < 0 ? min : null].filter((v): v is number => v !== null).map((v, i) => <line key={i} className="grid" x1={pad.s} x2={W - pad.s} y1={y(v)} y2={y(v)} strokeDasharray={v === 0 ? undefined : "2 4"} />)}
        {rows.map((r, i) => {
          // RTL reading: newest month on the left end of the axis = last; we draw right-to-left
          const x = W - pad.s - bw * (i + 0.5) - barW / 2;
          const top = y(Math.max(0, r.value)), h = Math.max(2, Math.abs(y(r.value) - y(0)));
          return (
            <g key={r.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${r.label}: ${money(r.value)}`}>
              <rect x={x - (bw - barW) / 2} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <rect x={x} y={top} width={barW} height={h} rx={4} className={r.value < 0 ? "s-neg" : "s1"} opacity={hover === null || hover === i ? 1 : 0.45} />
              <text x={x + barW / 2} y={H - 8} textAnchor="middle">{r.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && <div className="chart-tip" role="status">{rows[hover].label}: <b className="gc-num">{money(rows[hover].value)}</b></div>}
    </div>
  );
}

function AddRow({ table, onClose, onSaved }: { table: "business_expenses" | "other_income"; onClose: () => void; onSaved: () => void }) {
  const vault = useVault();
  const toast = useToast();
  const opts = table === "business_expenses" ? ["שכירות מגרש", "ביטוח", "פרסום", "שכר", "חשמל ומים", "רו״ח ועו״ד", "רישוי ואגרות", "אחר"] : ["תיקוני רכב ללקוחות", "מכירת חלקים ופירוק", "עמלות מימון", "אחר"];
  const [cat, setCat] = useState(opts[0]);
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("");
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const payload = table === "business_expenses" ? { category: cat, amount: toAgorot(Number(amount)), ...(vat ? { vat: toAgorot(Number(vat)) } : {}), ...(note ? { note } : {}) } : { category: cat, amount: toAgorot(Number(amount)), ...(note ? { note } : {}) };
    const enc = await vault.seal(table === "business_expenses" ? "business_expense" : "other_income", payload);
    const r = await addFinanceRow(table, `${month}-01`, enc);
    setBusy(false);
    if (!r.ok) return toast(r.error);
    toast("נשמר מוצפן"); onClose(); onSaved();
  }
  return (
    <Sheet title={table === "business_expenses" ? "הוצאה עסקית" : "הכנסה נוספת"} onClose={onClose} footer={<button className="gc-btn gc-btn--primary gc-btn--block" disabled={!amount || busy} onClick={save}>{busy ? "שומר…" : "שמירה"}</button>}>
      <div className="form">
        <div className="gc-chips" style={{ flexWrap: "wrap" }}>{opts.map((o) => <button key={o} className="gc-chip" aria-pressed={cat === o} onClick={() => setCat(o)}>{o}</button>)}</div>
        <MoneyField label="סכום" value={amount} onChange={setAmount} locked />
        {table === "business_expenses" && <MoneyField label="מתוכו מע״מ תשומות (לא חובה)" value={vat} onChange={setVat} locked />}
        <div className="grid2">
          <label className="gc-field"><span className="gc-field__label">חודש</span><span className="gc-field__control"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></span></label>
          <label className="gc-field"><span className="gc-field__label">הערה</span><span className="gc-field__control"><input value={note} onChange={(e) => setNote(e.target.value)} /></span></label>
        </div>
        <p className="t-caption">הכול כולל הקטגוריה והסכום מוצפן במכשיר. בשרת נשמר רק החודש.</p>
      </div>
    </Sheet>
  );
}
