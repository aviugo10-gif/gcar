"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { MoneyField } from "./MoneyField";
import { setLeadStatus, sendScrapQuote, setScrapStatus } from "@/app/admin/actions";
import { date, money, phone as fmtPhone, plate as fmtPlate, km, LEAD_STATUS, SCRAP_STATUS, toAgorot } from "@/lib/format";
import { toWhatsApp } from "@/lib/il";
import type { Lead, ScrapRequest } from "@/lib/types";

const Q: Record<string, string> = { starts: "מניע", drives: "נוסע", keys: "יש מפתחות", accident: "תאונה", fire_flood: "שריפה / הצפה", missing_parts: "חסרים חלקים", airbags: "כריות נפתחו", lien: "שעבוד" };
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? "עכשיו" : m < 60 ? `לפני ${m} דק׳` : m < 1440 ? `לפני ${Math.round(m / 60)} שע׳` : `לפני ${Math.round(m / 1440)} ימים`;
};
const wa = (phone: string, text: string) => `https://wa.me/${toWhatsApp(phone)}?text=${encodeURIComponent(text)}`;

export function Inbox({ leads, scrap, cars, initialTab, focus }: { leads: Lead[]; scrap: ScrapRequest[]; cars: Record<string, { title: string; slug: string | null }>; initialTab: "leads" | "scrap"; focus?: string }) {
  const [tab, setTab] = useState(initialTab);
  const [quote, setQuote] = useState<ScrapRequest | null>(() => (focus ? scrap.find((s) => s.id === focus && s.status === "new") ?? null : null));
  const nl = leads.filter((l) => l.status === "new").length, ns = scrap.filter((s) => s.status === "new").length;
  return (
    <div className="gc-stack" style={{ gap: 16 }}>
      <div className="gc-seg" role="tablist">
        <button role="tab" aria-selected={tab === "leads"} onClick={() => setTab("leads")}>מהאתר {nl > 0 && <span className="badge" style={{ marginInlineStart: 6 }}>{nl}</span>}</button>
        <button role="tab" aria-selected={tab === "scrap"} onClick={() => setTab("scrap")}>גריטה {ns > 0 && <span className="badge" style={{ marginInlineStart: 6 }}>{ns}</span>}</button>
      </div>
      {tab === "leads" ? (
        leads.length ? leads.map((l) => <LeadCard key={l.id} l={l} car={l.vehicle_id ? cars[l.vehicle_id] : undefined} />) : <Empty />
      ) : scrap.length ? scrap.map((s) => <ScrapCard key={s.id} s={s} onQuote={() => setQuote(s)} />) : <Empty />}
      {quote && <QuoteSheet s={quote} onClose={() => setQuote(null)} />}
    </div>
  );
}
const Empty = () => <div className="gc-empty"><span className="gc-empty__ic"><Icon name="inbox" /></span><p className="gc-empty__title">אין פניות</p><p className="gc-empty__text">פנייה חדשה מגיעה גם לטלגרם ולמייל.</p></div>;

function LeadCard({ l, car }: { l: Lead; car?: { title: string; slug: string | null } }) {
  const router = useRouter();
  const toast = useToast();
  const set = async (s: Lead["status"]) => { const prev = l.status; await setLeadStatus(l.id, s); toast(LEAD_STATUS[s], async () => { await setLeadStatus(l.id, prev); router.refresh(); }); router.refresh(); };
  const text = car ? `היי ${l.name}, כאן gcar. לגבי ה${car.title} שפנית אליו, ` : `היי ${l.name}, כאן gcar. `;
  return (
    <article className="card gc-stack" data-new={l.status === "new" ? "" : undefined}>
      <div className="row-between">
        <div className="gc-stack" style={{ gap: 2 }}>
          <b>{l.name}</b>
          <span className="t-caption">{l.kind === "notify_me" ? "בקשת עדכון על רכב" : car ? car.title : "פנייה כללית"} · {ago(l.created_at)}</span>
        </div>
        <span className={`gc-status ${l.status === "new" ? "gc-status--reserved" : l.status === "won" ? "gc-status--available" : l.status === "lost" ? "gc-status--sold" : "gc-status--prep"}`}>{LEAD_STATUS[l.status]}</span>
      </div>
      {l.message && <p className="bubble">{l.message}</p>}
      <div className="grid2">
        <a className="gc-btn gc-btn--outline" href={`tel:${l.phone}`} onClick={() => l.status === "new" && set("in_progress")}><Icon name="phone" />{fmtPhone(l.phone)}</a>
        <a className="gc-btn gc-btn--whatsapp" href={wa(l.phone, text)} target="_blank" rel="noreferrer" onClick={() => l.status === "new" && set("in_progress")}><Icon name="message-circle" />וואטסאפ</a>
      </div>
      <div className="gc-chips">{(["in_progress", "meeting", "won", "lost"] as const).map((s) => <button key={s} className="gc-chip" aria-pressed={l.status === s} onClick={() => set(s)}>{LEAD_STATUS[s]}</button>)}</div>
    </article>
  );
}

function Countdown({ until }: { until: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);
  const m = Math.round((Date.parse(until) - Date.now()) / 60000);
  return <span className={`gc-tag ${m < 0 ? "gc-tag--sale" : "gc-tag--glass"}`}><Icon name="clock" size="sm" />{m < 0 ? `עבר הזמן שהובטח (${-m} דק׳)` : m < 120 ? `נשארו ${m} דק׳ להבטחה` : `עד ${new Date(until).toLocaleString("he-IL", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" })}`}</span>;
}

function ScrapCard({ s, onQuote }: { s: ScrapRequest; onQuote: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const bad = (k: string, v: string) => (["starts", "drives", "keys"].includes(k) ? v === "לא" : v === "כן");
  const set = async (st: ScrapRequest["status"]) => { await setScrapStatus(s.id, st); toast(SCRAP_STATUS[st]); router.refresh(); };
  return (
    <article className="card gc-stack">
      <div className="row-between">
        <div className="gc-stack" style={{ gap: 4 }}>
          <b>{[s.make, s.model, s.year].filter(Boolean).join(" ") || "רכב לגריטה"}</b>
          <span className="t-caption">{s.name} · {s.city} · {ago(s.created_at)}</span>
        </div>
        {s.plate && <span className="gc-plate gc-plate--sm"><span className="gc-plate__il">IL</span><span className="gc-plate__num">{fmtPlate(s.plate)}</span></span>}
      </div>
      {s.status === "new" && s.promised_by && <Countdown until={s.promised_by} />}
      <div className="answers">
        {s.km ? <span>{km(s.km)}</span> : null}
        {Object.entries(s.answers).map(([k, v]) => <span key={k} data-bad={bad(k, v) ? "" : undefined}>{Q[k] ?? k}: <b>{v}</b></span>)}
      </div>
      {s.status === "quoted" && <div className="alert alert--info"><Icon name="banknote" /><span>נשלחה הצעה של <b className="gc-num">{money(s.quote_amount)}</b>, בתוקף עד {date(s.quote_valid_until)}</span></div>}
      <div className="grid2">
        <a className="gc-btn gc-btn--outline" href={`tel:${s.phone}`}><Icon name="phone" />{s.contact_pref === "call" ? "מעדיף שיחה" : "חיוג"}</a>
        {s.status === "new" ? <button className="gc-btn gc-btn--primary" onClick={onQuote}><Icon name="banknote" />שליחת הצעה</button>
          : s.status === "quoted" ? <button className="gc-btn gc-btn--primary" onClick={() => set("accepted")}><Icon name="check" />הלקוח אישר</button>
          : s.status === "accepted" ? <button className="gc-btn gc-btn--primary" onClick={() => set("collected")}><Icon name="truck" />נאסף</button>
          : <span className="gc-status gc-status--sold" style={{ alignSelf: "center", justifySelf: "center" }}>{SCRAP_STATUS[s.status]}</span>}
      </div>
      {["new", "quoted"].includes(s.status) && <button className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => set("rejected")}>לא רלוונטי</button>}
    </article>
  );
}

function QuoteSheet({ s, onClose }: { s: ScrapRequest; onClose: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const car = [s.make, s.model, s.year].filter(Boolean).join(" ");
  const text = `שלום ${s.name}, כאן gcar. לגבי ה${car}${s.plate ? ` (${fmtPlate(s.plate)})` : ""}: ההצעה שלנו היא ₪ ${Number(amount || 0).toLocaleString("he-IL")}, כולל איסוף מ${s.city ?? "המקום"} וטיפול בניירת. ההצעה בתוקף ${days} ימים, בכפוף לבדיקה במקום. מתאים לך?`;
  async function send() {
    setBusy(true);
    const w = window.open(wa(s.phone, text), "_blank", "noopener"); // open first, so the popup isn't blocked
    await sendScrapQuote(s.id, toAgorot(Number(amount)), days);
    setBusy(false);
    if (!w) location.href = wa(s.phone, text);
    onClose(); router.refresh();
  }
  return (
    <Sheet title={`הצעה: ${car}`} onClose={onClose} footer={<button className="gc-btn gc-btn--whatsapp gc-btn--block" disabled={!amount || busy} onClick={send}><Icon name="message-circle" />שליחה בוואטסאפ</button>}>
      <div className="form">
        <MoneyField label="סכום ההצעה" value={amount} onChange={setAmount} />
        <div><span className="t-label">תוקף</span><div className="gc-seg" role="tablist" style={{ marginTop: 6 }}>{[3, 7, 14].map((d) => <button key={d} role="tab" aria-selected={days === d} onClick={() => setDays(d)}>{d} ימים</button>)}</div></div>
        <div><span className="t-label">ההודעה שתישלח</span><p className="bubble bubble--out">{text}</p></div>
      </div>
    </Sheet>
  );
}
