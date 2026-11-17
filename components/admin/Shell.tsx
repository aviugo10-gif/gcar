"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Logo } from "../Icon";
import type { IconName } from "../icons-data";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "בית", icon: "home" },
  { href: "/admin/inventory", label: "מלאי", icon: "car" },
  { href: "/admin/inbox", label: "פניות", icon: "inbox" },
  { href: "/admin/more", label: "עוד", icon: "more" },
];
const RAIL: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "בית", icon: "home" },
  { href: "/admin/inventory", label: "מלאי", icon: "car" },
  { href: "/admin/inbox", label: "פניות", icon: "inbox" },
  { href: "/admin/customers", label: "לקוחות", icon: "users" },
  { href: "/admin/deals", label: "עסקאות", icon: "receipt" },
  { href: "/admin/finance", label: "כספים", icon: "bar-chart" },
  { href: "/admin/more", label: "הגדרות ועוד", icon: "sliders" },
];
const active = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

export function Shell({ children, inbox, demo }: { children: React.ReactNode; inbox: number; demo: boolean }) {
  const path = usePathname();
  const moreActive = ["/admin/more", "/admin/customers", "/admin/deals", "/admin/finance"].some((h) => path.startsWith(h));
  return (
    <div className="app">
      {demo && <div className="demo-ribbon">מצב הדגמה</div>}
      <nav className="app-rail" aria-label="ניווט ראשי">
        <Logo className="rail-logo" />
        <Link href="/admin/inventory/new" className="gc-btn gc-btn--accent" style={{ marginBottom: 12 }}><Icon name="scan-line" />רכב חדש</Link>
        {RAIL.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(path, n.href) ? "page" : undefined}>
            <Icon name={n.icon} />{n.label}{n.href === "/admin/inbox" && inbox > 0 && <span className="badge">{inbox}</span>}
          </Link>
        ))}
        <a href="/" target="_blank" rel="noreferrer" style={{ marginTop: "auto" }}><Icon name="globe" />לאתר</a>
      </nav>
      <div style={{ minWidth: 0 }}>{children}</div>
      <nav className="app-nav" aria-label="ניווט">
        <div className="gc-nav">
          {NAV.slice(0, 2).map((n) => <NavLink key={n.href} {...n} current={active(path, n.href)} />)}
          <Link href="/admin/inventory/new" className="gc-nav__scan" aria-label="הוספת רכב לפי לוחית"><Icon name="scan-line" /></Link>
          <NavLink {...NAV[2]} current={active(path, NAV[2].href)} badge={inbox} />
          <NavLink {...NAV[3]} current={moreActive} />
        </div>
      </nav>
    </div>
  );
}
function NavLink({ href, label, icon, current, badge }: { href: string; label: string; icon: IconName; current: boolean; badge?: number }) {
  return (
    <Link href={href} aria-current={current ? "page" : undefined} style={{ position: "relative" }}>
      <Icon name={icon} />{label}
      {!!badge && <span className="badge badge--nav" aria-label={`${badge} חדשות`}>{badge}</span>}
    </Link>
  );
}

/** Top bar for each screen: title, optional back link and actions. */
export function TopBar({ title, back, children }: { title: string; back?: string; children?: React.ReactNode }) {
  return (
    <header className="app-top">
      {back && <Link href={back} className="gc-btn gc-btn--ghost gc-btn--icon" aria-label="חזרה"><Icon name="chevron-right" /></Link>}
      <h1 className="app-top__title">{title}</h1>
      {children}
    </header>
  );
}
