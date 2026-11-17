import Link from "next/link";
import { Icon } from "@/components/Icon";
export default function NotFound() {
  return (
    <div className="wrap section">
      <div className="card" style={{ padding: 0 }}><div className="gc-empty"><div className="gc-empty__ic"><Icon name="search" size="lg" /></div><h1 className="gc-empty__title">העמוד לא נמצא</h1><p className="gc-empty__text">אולי הרכב כבר נמכר, או שהקישור השתנה.</p><Link className="gc-btn gc-btn--primary" href="/cars">לכל הרכבים</Link></div></div>
    </div>
  );
}
