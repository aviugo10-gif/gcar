import { money, date } from "@/lib/format";
import type { DealBalance } from "@/lib/types";

export function PayProgress({ b }: { b: DealBalance }) {
  const pct = b.sale_price ? Math.min(100, Math.round((b.paid / b.sale_price) * 100)) : 0;
  const cls = b.overdue_count ? "gc-pay--overdue" : b.outstanding > 0 ? "gc-pay--debt" : "";
  return (
    <div className={`gc-pay ${cls}`}>
      <div className="gc-pay__top"><span>שולם <b className="gc-num">{money(b.paid)}</b> מתוך <span className="gc-num">{money(b.sale_price)}</span></span><span className="gc-num">{pct}%</span></div>
      <div className="gc-pay__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="התקדמות תשלום"><span className="gc-pay__fill" style={{ width: `${pct}%` }} /></div>
      <div className="gc-pay__foot">
        <span>{b.outstanding > 0 ? <>יתרה <b className="gc-num">{money(b.outstanding)}</b></> : "שולם במלואו"}</span>
        <span>{b.overdue_count ? `${b.overdue_count} באיחור` : b.next_due ? `הבא: ${date(b.next_due, true)}` : ""}</span>
      </div>
    </div>
  );
}
