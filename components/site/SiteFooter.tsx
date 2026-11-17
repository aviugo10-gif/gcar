import Link from "next/link";
import { Logo } from "../Icon";
import { phone as fmtPhone } from "@/lib/format";
import type { Settings } from "@/lib/types";

const DAY: [keyof Settings["hours"], string][] = [["sun", "א׳–ה׳"], ["fri", "ו׳"], ["sat", "שבת"]];

export function SiteFooter({ s }: { s: Settings }) {
  const h = (k: keyof Settings["hours"]) => (s.hours[k] ? `${s.hours[k]![0]}–${s.hours[k]![1]}` : "סגור");
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__grid">
        <div className="gc-stack">
          <Logo className="footer-logo" label={s.business.name} />
          <p style={{ opacity: 0.7, maxWidth: "36ch" }}>{s.business.tagline}</p>
        </div>
        <div>
          <h3>האתר</h3>
          <ul><li><Link href="/cars">רכבים במלאי</Link></li><li><Link href="/sell-scrap">מכירת רכב לפירוק</Link></li><li><Link href="/contact">צור קשר</Link></li></ul>
        </div>
        <div>
          <h3>שעות פעילות</h3>
          <ul>{DAY.map(([k, l]) => <li key={k}>{l} <span className="gc-num">{h(k)}</span></li>)}</ul>
        </div>
        <div>
          <h3>מידע</h3>
          <ul>
            <li><a href={`tel:${s.business.phone}`} className="gc-num">{fmtPhone(s.business.phone)}</a></li>
            {s.business.address && <li>{s.business.address}</li>}
            <li><Link href="/privacy">מדיניות פרטיות</Link></li><li><Link href="/terms">תקנון</Link></li><li><Link href="/accessibility">הצהרת נגישות</Link></li>
          </ul>
        </div>
      </div>
      <div className="wrap" style={{ marginTop: 32, opacity: 0.55, fontSize: 13 }}>© {new Date().getFullYear()} {s.business.name}. התמונות באתר להמחשה, המחירים עשויים להשתנות.</div>
    </footer>
  );
}
