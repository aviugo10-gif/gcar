"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "../Icon";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { setVehicleStatus } from "@/app/admin/actions";
import { money, km, plate as fmtPlate, daysSince, daysTone, STATUS } from "@/lib/format";
import { PHOTO_BASE } from "@/lib/env";

export type Row = { id: string; plate: string; title: string; year: number | null; km: number | null; status: string; stock_in_date: string; price: number | null; published: boolean; photo: string | null };
const FILTERS = [["stock", "במלאי"], ["available", "זמין"], ["prep", "בהכנה"], ["reserved", "שמור"], ["sold", "נמכר"]] as const;

export function InventoryList({ vehicles, initialStatus, customers }: { vehicles: Row[]; initialStatus: string; customers: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState<"days" | "new">("days");
  const [menu, setMenu] = useState<Row | null>(null);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, vehicles.filter((v) => (k === "stock" ? v.status !== "sold" : v.status === k)).length])), [vehicles]);
  const rows = useMemo(() => {
    const n = q.replace(/[-\s]/g, "").toLowerCase();
    return vehicles
      .filter((v) => (status === "stock" ? v.status !== "sold" : v.status === status))
      .filter((v) => !n || v.plate.includes(n) || v.title.toLowerCase().replace(/\s/g, "").includes(n) || String(v.year ?? "").includes(n))
      .sort((a, b) => (sort === "days" ? Date.parse(a.stock_in_date) - Date.parse(b.stock_in_date) : Date.parse(b.stock_in_date) - Date.parse(a.stock_in_date)));
  }, [vehicles, q, status, sort]);

  return (
    <div className="gc-stack" style={{ gap: 12 }}>
      <label className="searchbar"><Icon name="search" className="gc-faint" /><input type="search" placeholder="לוחית, דגם או שנה" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש במלאי" inputMode="search" /></label>
      <div className="gc-chips" role="group" aria-label="סינון לפי סטטוס">
        {FILTERS.map(([k, l]) => <button key={k} className="gc-chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{l}<span className="gc-chip__count">{counts[k]}</span></button>)}
      </div>
      <div className="row-between">
        <span className="t-caption">{rows.length} רכבים · החלקה ימינה לפעולות</span>
        <button className="gc-btn gc-btn--ghost gc-btn--sm" onClick={() => setSort(sort === "days" ? "new" : "days")}><Icon name="arrow-up-down" size="sm" />{sort === "days" ? "הכי הרבה ימים" : "החדשים קודם"}</button>
      </div>
      {rows.length ? (
        <div className="list">{rows.map((v) => <VRow key={v.id} v={v} onMore={() => setMenu(v)} />)}</div>
      ) : (
        <div className="gc-empty"><span className="gc-empty__ic"><Icon name="car" /></span><p className="gc-empty__title">אין רכבים כאן</p><p className="gc-empty__text">{q ? "נסו חיפוש אחר" : "מוסיפים רכב בכפתור הצהוב"}</p></div>
      )}
      {menu && <StatusSheet v={menu} customers={customers} onClose={() => setMenu(null)} />}
    </div>
  );
}

function VRow({ v, onMore }: { v: Row; onMore: () => void }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const start = useRef<{ x: number; y: number; dx: number } | null>(null);
  const [open, setOpen] = useState(false);
  const d = daysSince(v.stock_in_date);
  const W = 176;
  const set = (x: number) => { if (ref.current) ref.current.style.transform = `translateX(${x}px)`; };
  return (
    <div className="gc-vrow">
      {v.status !== "sold" && (
        <div className="gc-vrow__actions" aria-hidden={!open}>
          <span />
          <span style={{ display: "flex" }}>
            <Link href={`/admin/deals/new?vehicle=${v.id}`} className="gc-vrow__act gc-vrow__act--sold" tabIndex={open ? 0 : -1}><Icon name="receipt" />עסקה</Link>
            <button className="gc-vrow__act gc-vrow__act--more" onClick={() => { set(0); setOpen(false); onMore(); }} tabIndex={open ? 0 : -1}><Icon name="sliders" />סטטוס</button>
          </span>
        </div>
      )}
      <Link
        ref={ref}
        href={`/admin/inventory/${v.id}`}
        className="gc-vrow__main"
        onClick={(e) => { if (open) { e.preventDefault(); set(0); setOpen(false); } }}
        onTouchStart={(e) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0 }; if (ref.current) ref.current.style.transition = "none"; }}
        onTouchMove={(e) => {
          const s = start.current; if (!s || v.status === "sold") return;
          const dx = e.touches[0].clientX - s.x, dy = e.touches[0].clientY - s.y;
          if (Math.abs(dy) > Math.abs(dx)) return;
          s.dx = dx;
          // RTL: the actions sit at the trailing (left) edge, so the row slides right to uncover them, as on iOS in Hebrew
          set(Math.min(W, Math.max(0, (open ? W : 0) + dx)));
        }}
        onTouchEnd={() => {
          const s = start.current; start.current = null; if (ref.current) ref.current.style.transition = "";
          if (!s) return;
          const o = open ? s.dx > -40 : s.dx > 60;
          setOpen(o); set(o ? W : 0);
        }}
      >
        {v.photo ? <img className="gc-vrow__thumb" src={PHOTO_BASE + v.photo} alt="" loading="lazy" /> : <span className="gc-vrow__thumb" style={{ display: "grid", placeItems: "center" }}><Icon name="car" className="gc-faint" /></span>}
        <span className="gc-vrow__info">
          <span className="gc-vrow__name">{v.title} {v.year ?? ""}</span>
          <span className="gc-vrow__meta"><span className="gc-plate gc-plate--sm"><span className="gc-plate__il">IL</span><span className="gc-plate__num">{fmtPlate(v.plate)}</span></span>{v.km != null && <span>{km(v.km)}</span>}</span>
        </span>
        <span className="gc-vrow__end">
          <span className={`gc-status gc-status--${v.status}`}>{STATUS[v.status]}</span>
          <span className="gc-vrow__price gc-num">{money(v.price)}</span>
          {v.status !== "sold" && <span className={`gc-days ${daysTone(d) ? "gc-days--" + daysTone(d) : ""}`}>{d} ימים</span>}
        </span>
      </Link>
    </div>
  );
}

export function StatusSheet({ v, customers, onClose }: { v: { id: string; title: string; status: string }; customers: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reserve, setReserve] = useState(false);
  const [cust, setCust] = useState("");
  const [days, setDays] = useState(3);
  const [pending, start] = useTransition();
  const go = (s: "prep" | "available" | "reserved") =>
    start(async () => {
      const prev = v.status as "prep" | "available" | "reserved";
      const until = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const r = await setVehicleStatus(v.id, s, s === "reserved" ? cust : undefined, s === "reserved" ? until : undefined);
      if (!r.ok) return toast(r.error);
      onClose(); router.refresh();
      toast(`${v.title}: ${STATUS[s]}`, prev !== "reserved" || s !== "reserved" ? async () => { await setVehicleStatus(v.id, prev); router.refresh(); } : undefined);
    });
  return (
    <Sheet title={`סטטוס: ${v.title}`} onClose={onClose}>
      {!reserve ? (
        <div className="ios-list">
          {(["prep", "available"] as const).map((s) => (
            <button key={s} className="ios-btn" disabled={pending || v.status === s} onClick={() => go(s)}><span className={`gc-status gc-status--${s}`}>{STATUS[s]}</span><span className="grow" />{v.status === s && <Icon name="check" />}</button>
          ))}
          <button className="ios-btn" onClick={() => setReserve(true)}><span className="gc-status gc-status--reserved">שמור ללקוח</span><span className="grow" /><Icon name="chevron-left" /></button>
          <Link className="ios-btn" href={`/admin/deals/new?vehicle=${v.id}`}><span className="gc-status gc-status--sold">נמכר</span><span className="grow t-caption">דרך עסקה בלבד</span><Icon name="chevron-left" /></Link>
        </div>
      ) : (
        <div className="form">
          <label className="gc-field"><span className="gc-field__label">ללקוח</span><span className="gc-field__control"><select value={cust} onChange={(e) => setCust(e.target.value)}><option value="">בחירה…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></span></label>
          <div><span className="t-label">לכמה ימים</span><div className="gc-seg" role="tablist" style={{ marginTop: 6 }}>{[1, 3, 7].map((d) => <button key={d} role="tab" aria-selected={days === d} onClick={() => setDays(d)}>{d === 1 ? "יום" : `${d} ימים`}</button>)}</div></div>
          <button className="gc-btn gc-btn--primary gc-btn--block" disabled={!cust || pending} onClick={() => go("reserved")}>שמירת הרכב</button>
          <Link href="/admin/customers?new=1" className="gc-btn gc-btn--ghost gc-btn--block">לקוח חדש</Link>
        </div>
      )}
    </Sheet>
  );
}
