"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../Icon";

const BUDGETS = [["", "כל תקציב"], ["50000", "עד ₪ 50,000"], ["80000", "עד ₪ 80,000"], ["120000", "עד ₪ 120,000"], ["200000", "עד ₪ 200,000"]];

export function QuickSearch({ makes }: { makes: [string, number][] }) {
  const r = useRouter();
  const [make, setMake] = useState("");
  const [max, setMax] = useState("");
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (make) p.set("make", make);
    if (max) p.set("max", max);
    r.push(`/cars${p.size ? `?${p}` : ""}`);
  };
  return (
    <form onSubmit={go} style={{ display: "contents" }} role="search" aria-label="חיפוש מהיר">
      <label className="gc-field"><span className="gc-field__label">יצרן</span>
        <span className="gc-field__control"><select value={make} onChange={(e) => setMake(e.target.value)}><option value="">כל היצרנים</option>{makes.map(([m, n]) => <option key={m} value={m}>{m} ({n})</option>)}</select></span>
      </label>
      <label className="gc-field"><span className="gc-field__label">תקציב</span>
        <span className="gc-field__control"><select value={max} onChange={(e) => setMax(e.target.value)}>{BUDGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></span>
      </label>
      <button className="gc-btn gc-btn--primary" type="submit"><Icon name="search" />חיפוש</button>
    </form>
  );
}
