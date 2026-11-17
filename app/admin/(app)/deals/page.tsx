import Link from "next/link";
import { TopBar } from "@/components/admin/Shell";
import { Icon } from "@/components/Icon";
import { PayProgress } from "@/components/admin/PayProgress";
import * as A from "@/lib/data/admin";
import { date } from "@/lib/format";

export const metadata = { title: "עסקאות" };

export default async function Page() {
  const [deals, bal, vehicles, customers] = await Promise.all([A.listDeals(), A.balances(), A.listVehicles(), A.listCustomers()]);
  return (
    <>
      <TopBar title="עסקאות" back="/admin/more" />
      <main className="app-main gc-stack" style={{ gap: 12 }}>
        {deals.length ? deals.map((d) => {
          const v = vehicles.find((x) => x.id === d.vehicle_id);
          const c = customers.find((x) => x.id === d.customer_id);
          const b = bal.find((x) => x.deal_id === d.id);
          return (
            <Link key={d.id} href={`/admin/deals/${d.id}`} className="card tile-link gc-stack">
              <div className="row-between"><b>{v ? `${v.make} ${v.model} ${v.year ?? ""}` : "רכב"}</b><span className="t-caption">{date(d.deal_date)}</span></div>
              <span className="t-caption">{c?.full_name}{d.status === "cancelled" ? " · בוטלה" : ""}</span>
              {b && <PayProgress b={b} />}
            </Link>
          );
        }) : <div className="gc-empty"><span className="gc-empty__ic"><Icon name="receipt" /></span><p className="gc-empty__title">עוד אין עסקאות</p></div>}
        <Link href="/admin/deals/new" className="gc-btn gc-btn--primary fab"><Icon name="plus" />עסקה חדשה</Link>
      </main>
    </>
  );
}
