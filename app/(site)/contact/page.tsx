import type { Metadata } from "next";
import { getSettings } from "@/lib/data/public";
import { LeadForm } from "@/components/site/LeadForm";
import { Icon } from "@/components/Icon";
import { phone as fmtPhone } from "@/lib/format";
import { waLink } from "@/lib/wa";

export const metadata: Metadata = { title: "צור קשר" };
const DAYS: [string, string][] = [["sun", "ראשון"], ["mon", "שני"], ["tue", "שלישי"], ["wed", "רביעי"], ["thu", "חמישי"], ["fri", "שישי"], ["sat", "שבת"]];

export default async function Contact() {
  const s = await getSettings();
  const waze = s.contact.waze ?? (s.business.lat ? `https://waze.com/ul?ll=${s.business.lat},${s.business.lng}&navigate=yes` : null);
  const maps = s.contact.maps ?? (s.business.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.business.address)}` : null);
  return (
    <div className="wrap section">
      <h1 className="t-display-l" style={{ marginBottom: 24 }}>צור קשר</h1>
      <div className="car">
        <div className="gc-stack" style={{ gap: 16 }}>
          <div className="gc-row">
            <a className="gc-btn gc-btn--primary" href={`tel:${s.business.phone}`}><Icon name="phone" /><span className="gc-num">{fmtPhone(s.business.phone)}</span></a>
            <a className="gc-btn gc-btn--whatsapp" href={waLink(s.business.phone)} target="_blank" rel="noopener"><Icon name="message-circle" />וואטסאפ</a>
            {waze && <a className="gc-btn gc-btn--outline" href={waze} target="_blank" rel="noopener"><Icon name="navigation" />Waze</a>}
            {maps && <a className="gc-btn gc-btn--outline" href={maps} target="_blank" rel="noopener"><Icon name="map-pin" />Google Maps</a>}
          </div>
          <div className="card gc-stack">
            <h2 className="t-title-m">כתובת המגרש</h2>
            <p className="gc-muted">{s.business.address ?? "הכתובת תעודכן בקרוב. בינתיים אפשר להתקשר ונכוון אתכם."}</p>
          </div>
          <div className="card">
            <h2 className="t-title-m" style={{ marginBottom: 12 }}>שעות פעילות</h2>
            <dl className="kv">{DAYS.map(([k, l]) => { const h = s.hours[k as keyof typeof s.hours]; return [<dt key={k + "t"}>{l}</dt>, <dd key={k + "d"} className="gc-num">{h ? `${h[0]}–${h[1]}` : "סגור"}</dd>]; })}</dl>
          </div>
        </div>
        <div className="card"><h2 className="t-title-m" style={{ marginBottom: 12 }}>השאירו הודעה</h2><LeadForm kind="general" messageLabel="במה אפשר לעזור?" /></div>
      </div>
    </div>
  );
}
