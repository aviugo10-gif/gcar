import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCar, getCatalog, getSettings, getSoldStub } from "@/lib/data/public";
import { BodyClass } from "@/components/BodyClass";
import { Gallery } from "@/components/site/Gallery";
import { LeadForm } from "@/components/site/LeadForm";
import { VehicleCard } from "@/components/site/VehicleCard";
import { Icon, type IconName } from "@/components/Icon";
import { money, num, date, FUEL, GEARBOX, OWNERSHIP, TAG, phone as fmtPhone } from "@/lib/format";
import { PHOTO_BASE, SITE_URL } from "@/lib/env";
import { waLink } from "@/lib/wa";
import type { PublicCar } from "@/lib/types";

export const revalidate = 60;
type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const car = await getCar((await params).slug);
  if (!car) return { title: "הרכב נמכר" };
  const t = `${car.title}${car.year ? ` ${car.year}` : ""} · ${money(car.sale_price ?? car.price)}`;
  return {
    title: t,
    description: [car.km != null && `${num(car.km)} ק״מ`, car.hand && `יד ${car.hand}`, car.gearbox && GEARBOX[car.gearbox]].filter(Boolean).join(" · "),
    openGraph: { title: t, images: car.photos[0] && !car.photos[0].path.endsWith(".svg") ? [PHOTO_BASE + car.photos[0].path] : undefined },
    alternates: { canonical: `/cars/${car.slug}` },
  };
}

function similar(all: PublicCar[], car: { make: string; price?: number | null; slug?: string }) {
  const p = car.price ?? 0;
  return all.filter((c) => c.slug !== car.slug).sort((a, b) => Number(b.make === car.make) - Number(a.make === car.make) || Math.abs((a.price ?? 0) - p) - Math.abs((b.price ?? 0) - p)).slice(0, 3);
}

export default async function CarPage({ params }: P) {
  const { slug } = await params;
  const [car, all, s] = await Promise.all([getCar(slug), getCatalog(), getSettings()]);
  if (!car) {
    const stub = await getSoldStub(slug);
    if (!stub) notFound();
    return (
      <div className="wrap section">
        <div className="card" style={{ padding: 0 }}><div className="gc-empty"><div className="gc-empty__ic"><Icon name="check" size="lg" /></div><h1 className="gc-empty__title">ה{stub.title} כבר נמכר</h1><p className="gc-empty__text">הנה רכבים דומים שעדיין במגרש.</p><Link className="gc-btn gc-btn--primary" href="/cars">לכל הרכבים</Link></div></div>
        <div className="grid-cars" style={{ marginTop: 24 }}>{similar(all, { make: stub.make }).map((c) => <VehicleCard key={c.slug} car={c} />)}</div>
      </div>
    );
  }
  const price = car.sale_price ?? car.price;
  const specs: { k: string; v: React.ReactNode; i: IconName }[] = [
    car.year ? { k: "שנה", v: car.year, i: "calendar" as IconName } : null,
    car.km != null ? { k: "קילומטראז׳", v: <span className="gc-num">{num(car.km)}</span>, i: "gauge" as IconName } : null,
    car.hand ? { k: "יד", v: car.hand, i: "users" as IconName } : null,
    car.gearbox ? { k: "תיבת הילוכים", v: GEARBOX[car.gearbox], i: "cog" as IconName } : null,
    car.engine_cc ? { k: "נפח מנוע", v: <span className="gc-num">{num(car.engine_cc)} סמ״ק</span>, i: "zap" as IconName } : null,
    car.fuel ? { k: "דלק", v: FUEL[car.fuel], i: "fuel" as IconName } : null,
    car.test_valid_until ? { k: "טסט בתוקף עד", v: <span className="gc-num">{date(car.test_valid_until)}</span>, i: "file-text" as IconName } : null,
    car.color ? { k: "צבע", v: car.color, i: "brush" as IconName } : null,
  ].filter(Boolean) as { k: string; v: React.ReactNode; i: IconName }[];
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Car", name: `${car.title} ${car.year ?? ""}`.trim(), brand: car.make, model: car.model,
    vehicleModelDate: car.year ?? undefined, mileageFromOdometer: car.km != null ? { "@type": "QuantitativeValue", value: car.km, unitCode: "KMT" } : undefined,
    offers: price ? { "@type": "Offer", price: price / 100, priceCurrency: "ILS", availability: "https://schema.org/InStock", url: `${SITE_URL}/cars/${car.slug}` } : undefined,
  };
  return (
    <div className="has-contactbar-scope">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <BodyClass name="has-contactbar" />
      <div className="wrap">
        <nav aria-label="פירורי לחם" className="t-caption" style={{ padding: "16px 0 0" }}><Link href="/cars">רכבים במלאי</Link> / {car.make}</nav>
        <div className="car">
          <div className="gc-stack" style={{ gap: 24 }}>
            <Gallery photos={car.photos.map((p) => ({ src: PHOTO_BASE + p.path, w: p.w, h: p.h }))} title={car.title} />
            <section aria-labelledby="specs"><h2 className="t-title-l" id="specs" style={{ marginBottom: 12 }}>מפרט</h2>
              <div className="specs">{specs.map((x) => <div key={x.k} className="spec"><span className="spec__k"><Icon name={x.i} size="sm" />{x.k}</span><span className="spec__v">{x.v}</span></div>)}</div>
            </section>
            {car.ownership_flags.length > 0 && (
              <div className="disclosure" role="note"><Icon name="alert" /><div><strong>גילוי נאות: בעלויות קודמות</strong><br />{car.ownership_flags.map((f) => OWNERSHIP[f] ?? f).join(", ")}</div></div>
            )}
            {car.marketing_text && <section><h2 className="t-title-l" style={{ marginBottom: 8 }}>על הרכב</h2><p className="t-body-l gc-muted">{car.marketing_text}</p></section>}
            {car.equipment.length > 0 && (
              <section aria-labelledby="eq"><h2 className="t-title-l" id="eq" style={{ marginBottom: 12 }}>אבזור</h2>
                <ul className="gc-row" style={{ listStyle: "none", padding: 0, margin: 0 }}>{car.equipment.map((e) => <li key={e} className="gc-chip" style={{ cursor: "default" }}><Icon name="check" size="sm" />{e}</li>)}</ul>
              </section>
            )}
          </div>
          <aside className="car__side gc-stack" style={{ gap: 16 }}>
            <div className="card gc-stack">
              <div className="gc-row">{car.is_reserved && <span className="gc-status gc-status--reserved">שמור</span>}{car.tags.map((t) => TAG[t] && <span key={t} className={`gc-tag ${TAG[t].cls}`}>{TAG[t].label}</span>)}</div>
              <h1 className="t-display-l">{car.title}{car.year ? ` · ${car.year}` : ""}</h1>
              {car.trim && <p className="gc-muted">{car.trim}</p>}
              <div className="t-price-l"><span className="gc-num">{money(price)}</span>{car.sale_price && car.price ? <span className="price-old gc-num">{money(car.price)}</span> : null}</div>
              <div className="contactbar-fixed">
                <div className="gc-contactbar">
                  <a className="gc-btn gc-btn--whatsapp" href={waLink(s.business.phone, { title: car.title, year: car.year, slug: car.slug })} target="_blank" rel="noopener"><Icon name="message-circle" />וואטסאפ</a>
                  <a className="gc-btn gc-btn--primary" href={`tel:${s.business.phone}`}><Icon name="phone" /><span className="gc-num">{fmtPhone(s.business.phone)}</span></a>
                </div>
              </div>
            </div>
            <div className="card"><h2 className="t-title-m" style={{ marginBottom: 12 }}>רוצים שנחזור אליכם?</h2><LeadForm kind="vehicle" slug={car.slug} submitLabel="בקשת שיחה חוזרת" /></div>
          </aside>
        </div>
        <section className="section" aria-labelledby="sim"><h2 className="t-title-l" id="sim" style={{ marginBottom: 16 }}>רכבים דומים</h2>
          <div className="grid-cars">{similar(all, car).map((c) => <VehicleCard key={c.slug} car={c} />)}</div>
        </section>
      </div>
    </div>
  );
}
