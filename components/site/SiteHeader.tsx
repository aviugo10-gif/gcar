"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, Logo } from "../Icon";
import { phone as fmtPhone } from "@/lib/format";

const LINKS = [
  { href: "/cars", label: "רכבים במלאי" },
  { href: "/sell-scrap", label: "מכירת רכב לפירוק" },
  { href: "/contact", label: "צור קשר" },
];

export function SiteHeader({ phone }: { phone: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="site-header">
      <header className="gc-header">
        <div className="site-header__inner">
          <Link href="/" className="gc-header__logo" aria-label="gcar, לעמוד הבית"><Logo /></Link>
          <nav className="gc-header__links" aria-label="ראשי">
            {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? "page" : undefined}>{l.label}</Link>)}
          </nav>
          <div className="gc-row" style={{ flexWrap: "nowrap" }}>
            <a className="gc-btn gc-btn--outline gc-btn--sm" href={`tel:${phone}`}><Icon name="phone" size="sm" /><span className="gc-num">{fmtPhone(phone)}</span></a>
            <button className="gc-btn gc-btn--ghost gc-btn--icon menu-btn" aria-label="תפריט" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
          </div>
        </div>
      </header>
      {open && (
        <div className="mobile-menu">
          <div className="gc-scrim" style={{ position: "absolute", inset: 0 }} onClick={() => setOpen(false)} />
          <div className="gc-sheet" role="dialog" aria-modal="true" aria-label="תפריט" style={{ position: "relative" }}>
            <div className="gc-sheet__grab" />
            <div className="gc-sheet__head"><span className="gc-sheet__title">תפריט</span><button className="gc-btn gc-btn--ghost gc-btn--icon" aria-label="סגירה" onClick={() => setOpen(false)} autoFocus><Icon name="x" /></button></div>
            <nav aria-label="ראשי">
              <Link href="/">בית</Link>
              {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
              <Link href="/accessibility">הצהרת נגישות</Link>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
