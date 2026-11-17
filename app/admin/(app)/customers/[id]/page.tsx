import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/admin/Shell";
import { Icon } from "@/components/Icon";
import { PayProgress } from "@/components/admin/PayProgress";
import * as A from "@/lib/data/admin";
import { phone as fmtPhone, date } from "@/lib/format";
import { toWhatsApp } from "@/lib/il";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await A.getCustomer(id);
  if (!c) notFound();
  const [deals, bal, vehicles, leads] = await Promise.all([A.listDeals(), A.balances(), A.listVehicles(), A.listLeads()]);
  const mine = deals.filter((d) => d.customer_id === id);
  const reserved = vehicles.filter((v) => v.status === "reserved" && v.reserved_for === id);
  const myLeads = leads.filter((l) => l.phone === c.phone);
  return (
    <>
      <TopBar title={c.full_name} back="/admin/customers" />
      <main className="app-main narrow gc-stack" style={{ gap: 16 }}>
        <div className="quick-actions" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <a className="qa" href={`tel:${c.phone}`}><Icon name="phone" />חיוג</a>
          <a className="qa" href={`https://wa.me/${toWhatsApp(c.phone)}`} target="_blank" rel="noreferrer"><Icon name="message-circle" />וואטסאפ</a>
          <Link className="qa" href={`/admin/deals/new?customer=${c.id}`}><Icon name="receipt" />עסקה חדשה</Link>
        </div>
        <section className="card">
          <dl className="kv">
            <dt>טלפון</dt><dd className="gc-num" dir="ltr" style={{ textAlign: "start" }}>{fmtPhone(c.phone)}</dd>
            {c.id_number_last4 && <><dt>ת״ז</dt><dd className="gc-num">•••••{c.id_number_last4}</dd></>}
            {c.email && <><dt>אימייל</dt><dd dir="ltr" style={{ textAlign: "start" }}>{c.email}</dd></>}
            {c.address && <><dt>כתובת</dt><dd>{c.address}</dd></>}
            <dt>לקוח מאז</dt><dd>{date(c.created_at)}</dd>
          </dl>
          {c.notes && <p className="gc-muted" style={{ marginTop: 12 }}>{c.notes}</p>}
        </section>
        {reserved.map((v) => <Link key={v.id} href={`/admin/inventory/${v.id}`} className="attn"><span className="attn__ic attn__ic--info"><Icon name="clock" /></span><span className="attn__body"><span className="attn__t">שמור עבורו: {v.make} {v.model}</span><span className="attn__s">עד {date(v.reserved_until)}</span></span></Link>)}
        <h2 className="group-title">עסקאות</h2>
        {mine.length ? mine.map((d) => {
          const v = vehicles.find((x) => x.id === d.vehicle_id);
          const b = bal.find((x) => x.deal_id === d.id);
          return (
            <Link key={d.id} href={`/admin/deals/${d.id}`} className="card tile-link gc-stack">
              <div className="row-between"><b>{v ? `${v.make} ${v.model} ${v.year ?? ""}` : "רכב"}</b><span className="t-caption">{date(d.deal_date)}</span></div>
              {b && <PayProgress b={b} />}
            </Link>
          );
        }) : <p className="gc-muted">עוד אין עסקאות.</p>}
        {myLeads.length > 0 && <><h2 className="group-title">פניות מהאתר</h2>{myLeads.map((l) => <div key={l.id} className="row-link"><Icon name="message-circle" className="gc-faint" /><span className="row-link__main"><span className="row-link__t">{l.message ?? "פנייה"}</span><span className="row-link__s">{date(l.created_at)}</span></span></div>)}</>}
      </main>
    </>
  );
}
