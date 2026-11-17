"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo, useState, useEffect, useDeferredValue } from "react";
import { VehicleCard } from "./VehicleCard";
import { NotifyMe } from "./NotifyMe";
import { Icon } from "../Icon";
import { filterCatalog, type CatalogQuery } from "@/lib/catalog";
import { FUEL, GEARBOX, money } from "@/lib/format";
import type { PublicCar } from "@/lib/types";

const KEYS: (keyof CatalogQuery)[] = ["q", "make", "min", "max", "year", "km", "hand", "gearbox", "fuel", "sort"];
const SORTS = [["", "מומלצים"], ["new", "חדשים במגרש"], ["price_asc", "מחיר: מהזול"], ["price_desc", "מחיר: מהיקר"], ["year", "שנה: מהחדש"], ["km", "ק״מ: מהנמוך"]];

export function Catalog({ cars }: { cars: PublicCar[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const fromUrl = (): CatalogQuery => Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ""]).filter(([, v]) => v)) as CatalogQuery;
  const [q, setQ] = useState<CatalogQuery>(fromUrl);
  const [sheet, setSheet] = useState(false);
  const deferred = useDeferredValue(q);

  // filters live in the URL so a search can be shared
  useEffect(() => {
    const p = new URLSearchParams();
    KEYS.forEach((k) => q[k] && p.set(k, q[k]!));
    const t = setTimeout(() => router.replace(`${path}${p.size ? `?${p}` : ""}`, { scroll: false }), 250);
    return () => clearTimeout(t);
  }, [q, path, router]);

  const results = useMemo(() => filterCatalog(cars, deferred), [cars, deferred]);
  const set = (k: keyof CatalogQuery, v: string) => setQ((o) => ({ ...o, [k]: v || undefined }));
  const active = KEYS.filter((k) => k !== "sort" && k !== "q" && q[k]).length;
  const makes = useMemo(() => [...new Map(cars.map((c) => [c.make, cars.filter((x) => x.make === c.make).length])).entries()], [cars]);

  const filters = <Filters cars={cars} q={q} set={set} makes={makes} />;
  return (
    <div className="catalog">
      <aside className="filters" aria-label="סינון">{filters}</aside>
      <div>
        <div className="catalog__bar">
          <h1 className="t-display-l">רכבים במלאי</h1>
          <div className="searchbar" role="search">
            <Icon name="search" />
            <input type="search" placeholder="חיפוש: מאזדה 3, corolla…" value={q.q ?? ""} onChange={(e) => set("q", e.target.value)} aria-label="חיפוש רכב" enterKeyHint="search" />
            {q.q && <button className="gc-btn gc-btn--ghost gc-btn--icon gc-btn--sm" aria-label="ניקוי חיפוש" onClick={() => set("q", "")}><Icon name="x" size="sm" /></button>}
          </div>
          <div className="gc-chips catalog__mobile-only" role="group" aria-label="סינון מהיר">
            <button className="gc-chip" aria-pressed={active > 0} onClick={() => setSheet(true)}><Icon name="sliders" size="sm" />סינון{active ? ` (${active})` : ""}</button>
            {makes.map(([m, n]) => (
              <button key={m} className="gc-chip" aria-pressed={q.make === m} onClick={() => set("make", q.make === m ? "" : m)}>{m} <span className="gc-chip__count">{n}</span></button>
            ))}
            <button className="gc-chip" aria-pressed={q.gearbox === "auto"} onClick={() => set("gearbox", q.gearbox === "auto" ? "" : "auto")}>אוטומט</button>
            <button className="gc-chip" aria-pressed={q.hand === "1"} onClick={() => set("hand", q.hand === "1" ? "" : "1")}>יד ראשונה</button>
          </div>
          <div className="catalog__meta">
            <span className="t-label" aria-live="polite">{results.length} רכבים</span>
            <label className="gc-row" style={{ gap: 6 }}>
              <Icon name="arrow-up-down" size="sm" />
              <span className="gc-sr">מיון</span>
              <select value={q.sort ?? ""} onChange={(e) => set("sort", e.target.value)} style={{ border: 0, background: "transparent", font: "500 14px var(--font-sans)", color: "var(--ink)" }}>
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
        </div>
        {results.length ? (
          <div className="grid-cars">{results.map((c, i) => <VehicleCard key={c.slug} car={c} priority={i < 2} />)}</div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="gc-empty">
              <div className="gc-empty__ic"><Icon name="car" size="lg" /></div>
              <h2 className="gc-empty__title">אין כרגע רכב כזה במגרש</h2>
              <p className="gc-empty__text">השאירו פרטים ונודיע כשמגיע רכב שמתאים.</p>
              <button className="gc-btn gc-btn--outline" onClick={() => setQ({})}>ניקוי סינונים</button>
            </div>
            <div style={{ padding: "0 20px 24px", maxWidth: 480, margin: "0 auto" }}><NotifyMe initial={[q.make, q.q].filter(Boolean).join(" ")} /></div>
          </div>
        )}
      </div>

      {sheet && (
        <div className="sheet-wrap" onKeyDown={(e) => e.key === "Escape" && setSheet(false)}>
          <div className="gc-scrim" style={{ position: "absolute", inset: 0 }} onClick={() => setSheet(false)} />
          <div className="gc-sheet" role="dialog" aria-modal="true" aria-labelledby="f-t" style={{ position: "relative" }}>
            <div className="gc-sheet__grab" />
            <div className="gc-sheet__head"><h2 className="gc-sheet__title" id="f-t">סינון</h2><button className="gc-btn gc-btn--ghost gc-btn--sm" onClick={() => setQ({ q: q.q })}>ניקוי</button></div>
            {filters}
            <div className="sheet-foot"><button className="gc-btn gc-btn--primary gc-btn--block" onClick={() => setSheet(false)} autoFocus>הצגת {results.length} רכבים</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Filters({ cars, q, set, makes }: { cars: PublicCar[]; q: CatalogQuery; set: (k: keyof CatalogQuery, v: string) => void; makes: [string, number][] }) {
  const prices = cars.map((c) => (c.sale_price ?? c.price ?? 0) / 100);
  const lo = Math.floor(Math.min(...prices, 0) / 10000) * 10000;
  const hi = Math.ceil(Math.max(...prices, 10000) / 10000) * 10000;
  const B = 12, step = (hi - lo) / B || 1;
  const bins = Array.from({ length: B }, (_, i) => prices.filter((p) => p >= lo + i * step && p < lo + (i + 1) * step + (i === B - 1 ? 1 : 0)).length);
  const peak = Math.max(...bins, 1);
  const min = Number(q.min || lo), max = Number(q.max || hi);
  return (
    <div className="gc-stack" style={{ gap: 20 }}>
      <label className="gc-field"><span className="gc-field__label">יצרן</span>
        <span className="gc-field__control"><select value={q.make ?? ""} onChange={(e) => set("make", e.target.value)}><option value="">כל היצרנים</option>{makes.map(([m, n]) => <option key={m} value={m}>{m} ({n})</option>)}</select></span>
      </label>
      <div className="gc-field">
        <span className="gc-field__label">מחיר</span>
        <div className="histo" aria-hidden="true">{bins.map((b, i) => <span key={i} style={{ height: `${(b / peak) * 100}%` }} data-on={lo + (i + 1) * step > min && lo + i * step < max ? "" : undefined} />)}</div>
        <div className="range">
          <span className="gc-field__control"><span className="gc-field__affix">מ־₪</span><input inputMode="numeric" dir="ltr" placeholder={String(lo)} value={q.min ?? ""} onChange={(e) => set("min", e.target.value.replace(/\D/g, ""))} aria-label="מחיר מינימלי" /></span>
          <span className="gc-field__control"><span className="gc-field__affix">עד ₪</span><input inputMode="numeric" dir="ltr" placeholder={String(hi)} value={q.max ?? ""} onChange={(e) => set("max", e.target.value.replace(/\D/g, ""))} aria-label="מחיר מקסימלי" /></span>
        </div>
        <span className="gc-field__hint">{money(min * 100)} – {money(max * 100)}</span>
      </div>
      <label className="gc-field"><span className="gc-field__label">שנה, מ־</span>
        <span className="gc-field__control"><select value={q.year ?? ""} onChange={(e) => set("year", e.target.value)}><option value="">הכול</option>{Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y}>{y}</option>)}</select></span>
      </label>
      <label className="gc-field"><span className="gc-field__label">ק״מ, עד</span>
        <span className="gc-field__control"><select value={q.km ?? ""} onChange={(e) => set("km", e.target.value)}><option value="">הכול</option>{[30000, 60000, 100000, 150000, 200000].map((k) => <option key={k} value={k}>{k.toLocaleString("en-US")}</option>)}</select></span>
      </label>
      <div className="gc-field"><span className="gc-field__label">יד</span>
        <div className="gc-seg" role="radiogroup">{[["", "הכול"], ["1", "ראשונה"], ["2", "עד 2"], ["3", "עד 3"]].map(([v, l]) => <button key={v} role="radio" aria-selected={(q.hand ?? "") === v} aria-checked={(q.hand ?? "") === v} onClick={() => set("hand", v)}>{l}</button>)}</div>
      </div>
      <div className="gc-field"><span className="gc-field__label">תיבת הילוכים</span>
        <div className="gc-chips" style={{ flexWrap: "wrap" }}>{Object.entries(GEARBOX).map(([v, l]) => <button key={v} className="gc-chip" aria-pressed={q.gearbox === v} onClick={() => set("gearbox", q.gearbox === v ? "" : v)}>{l}</button>)}</div>
      </div>
      <div className="gc-field"><span className="gc-field__label">דלק</span>
        <div className="gc-chips" style={{ flexWrap: "wrap" }}>{Object.entries(FUEL).map(([v, l]) => <button key={v} className="gc-chip" aria-pressed={q.fuel === v} onClick={() => set("fuel", q.fuel === v ? "" : v)}>{l}</button>)}</div>
      </div>
    </div>
  );
}
