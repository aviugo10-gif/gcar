import Link from "next/link";
import { getCatalog, getSettings } from "@/lib/data/public";
import { VehicleCard } from "@/components/site/VehicleCard";
import { Icon } from "@/components/Icon";
import { PHOTO_BASE } from "@/lib/env";
import { QuickSearch } from "@/components/site/QuickSearch";

export const revalidate = 60;

export default async function Home() {
  const [cars, s] = await Promise.all([getCatalog(), getSettings()]);
  const featured = cars.slice(0, 6);
  const hero = cars[0]?.photos[0];
  const makes = [...new Map(cars.map((c) => [c.make, cars.filter((x) => x.make === c.make).length])).entries()];
  return (
    <>
      <section className="hero">
        <div className="wrap hero__inner">
          <div className="rise">
            <p className="t-label" style={{ color: "inherit", opacity: 0.7, marginBottom: 12 }}>{s.business.tagline}</p>
            <h1 className="t-display-xl">{s.home.headline}</h1>
            <p className="t-body-l hero__sub">{s.home.sub}</p>
            <div className="gc-row" style={{ marginTop: 24 }}>
              <Link href="/cars" className="gc-btn gc-btn--accent">לכל {cars.length} הרכבים<Icon name="chevron-left" /></Link>
              <Link href="/sell-scrap" className="gc-btn gc-btn--outline" style={{ background: "transparent", color: "inherit", borderColor: "currentColor" }}>מכירת רכב לפירוק</Link>
            </div>
          </div>
          {hero && (
            <div className="hero__media rise rise-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="photo" src={PHOTO_BASE + hero.path} alt={cars[0].title} fetchPriority="high" />
            </div>
          )}
        </div>
        <div className="hero__plate" aria-hidden="true" />
      </section>

      <div className="wrap quick">
        <div className="card quick__card rise rise-3"><QuickSearch makes={makes} /></div>
      </div>

      <section className="wrap section" aria-labelledby="featured">
        <div className="section__head"><h2 className="t-title-l" id="featured">רכבים נבחרים</h2><Link href="/cars" className="gc-btn gc-btn--ghost gc-btn--sm">לכל המלאי<Icon name="chevron-left" size="sm" /></Link></div>
        <div className="grid-cars">{featured.map((c, i) => <VehicleCard key={c.slug} car={c} priority={i < 2} />)}</div>
      </section>

      <section className="wrap section" aria-labelledby="scrap">
        <div className="scrap-cta">
          <div className="gc-stack">
            <h2 className="t-display-l" id="scrap">יש לכם רכב ישן או אחרי תאונה?</h2>
            <p className="t-body-l" style={{ maxWidth: "52ch" }}>ממלאים כמה פרטים, מקבלים הצעת מחיר, ואנחנו מטפלים בגרירה ובביטול הרישום. אישור בכתב שהרכב ירד מהכביש.</p>
          </div>
          <Link href="/sell-scrap" className="gc-btn gc-btn--primary">לקבלת הצעה<Icon name="chevron-left" /></Link>
        </div>
      </section>

      <section className="wrap section" aria-labelledby="why">
        <h2 className="t-title-l" id="why" style={{ marginBottom: 20 }}>למה gcar</h2>
        <div className="why">
          {[
            { i: "shield-check" as const, t: "שקיפות מלאה", d: "בעלויות קודמות, תאונות וק״מ כתובים בכל רכב. בלי הפתעות אחרי הקנייה." },
            { i: "wrench" as const, t: "קנייה, מכירה ושירות", d: "מכינים את הרכב לפני שהוא עולה למגרש, וממשיכים ללוות גם אחרי." },
            { i: "message-circle" as const, t: "מדברים עם בן אדם", d: "שאלה על רכב? הודעה בווצאפ ותקבלו תשובה ישירה." },
          ].map((w) => (
            <div key={w.t} className="why__item"><span className="why__ic"><Icon name={w.i} /></span><div><h3 className="t-title-m">{w.t}</h3><p className="gc-muted" style={{ marginTop: 4 }}>{w.d}</p></div></div>
          ))}
        </div>
      </section>
    </>
  );
}
