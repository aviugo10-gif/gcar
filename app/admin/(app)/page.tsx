import Link from "next/link";
import { TopBar } from "@/components/admin/Shell";
import { Icon } from "@/components/Icon";
import type { IconName } from "@/components/icons-data";
import { attention } from "@/lib/data/admin";
import { date, plate } from "@/lib/format";

export const metadata = { title: "בית" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()));
  return h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
}

export default async function Home() {
  const a = await attention();
  const items: { href: string; tone: "danger" | "warn" | "info" | "ok"; icon: IconName; t: string; s: string }[] = [];
  for (const s of a.scrapWaiting) items.push({ href: `/admin/inbox?tab=scrap&id=${s.id}`, tone: "danger", icon: "truck", t: `בקשת גריטה מחכה להצעה: ${s.make ?? ""} ${s.model ?? ""}`.trim(), s: `${s.name}, ${s.city ?? ""} · הובטח ${s.promised_by ? "עד " + new Date(s.promised_by).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }) : "בהקדם"}` });
  for (const o of a.overdue) items.push({ href: `/admin/deals/${o.deal?.id}`, tone: "danger", icon: "banknote", t: `תשלום באיחור: ${o.customer?.full_name ?? "לקוח"}`, s: `היה אמור להיכנס ב־${date(o.payment.due_date)}` });
  if (a.newLeads.length) items.push({ href: "/admin/inbox", tone: "info", icon: "message-circle", t: `${a.newLeads.length} פניות חדשות מהאתר`, s: a.newLeads.map((l) => l.name).join(", ") });
  for (const v of a.reservationsExpired) items.push({ href: `/admin/inventory/${v.id}`, tone: "warn", icon: "clock", t: `השמירה פגה: ${v.make} ${v.model}`, s: "לשחרר או להאריך" });
  for (const v of a.testsSoon) items.push({ href: `/admin/inventory/${v.id}`, tone: "warn", icon: "calendar", t: `טסט מסתיים: ${v.make} ${v.model}`, s: `${plate(v.plate)} · ${date(v.test_valid_until)}` });
  for (const v of a.stuck) items.push({ href: `/admin/inventory/${v.id}`, tone: "warn", icon: "gauge", t: `${v.make} ${v.model} במגרש מעל 60 יום`, s: "אולי לעדכן מחיר או לקדם באתר" });

  return (
    <>
      <TopBar title={greeting()}>
        <Link href="/admin/inventory/new" className="gc-btn gc-btn--primary gc-btn--sm desk-only"><Icon name="plus" size="sm" />רכב חדש</Link>
      </TopBar>
      <main className="app-main">
        <div className="kpis">
          <Link href="/admin/inventory" className="gc-stat gc-stat--ink tile-link"><span className="gc-stat__label"><Icon name="car" size="sm" />במלאי</span><span className="gc-stat__value gc-num">{a.counts.total}</span></Link>
          <Link href="/admin/inventory?status=available" className="gc-stat tile-link"><span className="gc-stat__label">זמינים באתר</span><span className="gc-stat__value gc-num">{a.counts.available}</span></Link>
          <Link href="/admin/inventory?status=prep" className="gc-stat tile-link"><span className="gc-stat__label">בהכנה</span><span className="gc-stat__value gc-num">{a.counts.prep}</span></Link>
          <Link href="/admin/inventory?status=reserved" className="gc-stat tile-link"><span className="gc-stat__label">שמורים</span><span className="gc-stat__value gc-num">{a.counts.reserved}</span></Link>
        </div>
        <h2 className="group-title">דורש טיפול</h2>
        {items.length ? (
          <div className="list">
            {items.map((i, k) => (
              <Link key={k} href={i.href} className="attn">
                <span className={`attn__ic attn__ic--${i.tone}`}><Icon name={i.icon} /></span>
                <span className="attn__body"><span className="attn__t">{i.t}</span><span className="attn__s">{i.s}</span></span>
                <Icon name="chevron-left" className="gc-faint" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="gc-empty"><span className="gc-empty__ic"><Icon name="check" /></span><p className="gc-empty__title">הכול מטופל</p><p className="gc-empty__text">אין כרגע משהו שמחכה לך.</p></div>
        )}
        <h2 className="group-title">פעולות מהירות</h2>
        <div className="quick-actions">
          <Link href="/admin/inventory/new" className="qa"><Icon name="scan-line" />רכב חדש</Link>
          <Link href="/admin/deals/new" className="qa"><Icon name="receipt" />עסקה חדשה</Link>
          <Link href="/admin/customers?new=1" className="qa"><Icon name="users" />לקוח חדש</Link>
          <Link href="/admin/finance" className="qa"><Icon name="lock" />כספים</Link>
        </div>
      </main>
    </>
  );
}
