import Link from "next/link";
import { Icon } from "../Icon";
import { money, num, FUEL, GEARBOX, TAG } from "@/lib/format";
import { PHOTO_BASE } from "@/lib/env";
import type { PublicCar } from "@/lib/types";

export function VehicleCard({ car, priority = false }: { car: PublicCar; priority?: boolean }) {
  const main = car.photos[0];
  const tags = car.is_reserved ? ["reserved", ...car.tags] : car.tags;
  const specs: { icon: Parameters<typeof Icon>[0]["name"]; text: React.ReactNode }[] = [];
  if (car.year) specs.push({ icon: "calendar", text: car.year });
  if (car.km != null) specs.push({ icon: "gauge", text: <><span className="gc-num">{num(car.km)}</span> ק״מ</> });
  if (car.hand) specs.push({ icon: "users", text: `יד ${car.hand}` });
  else if (car.gearbox) specs.push({ icon: "cog", text: GEARBOX[car.gearbox] });
  if (car.fuel && specs.length < 3) specs.push({ icon: car.fuel === "electric" || car.fuel === "hybrid" ? "zap" : "fuel", text: FUEL[car.fuel] });
  return (
    <Link className="gc-vcard" href={`/cars/${car.slug}`} aria-label={`${car.title} ${car.year ?? ""}, ${money(car.sale_price ?? car.price)}`}>
      <div className="gc-vcard__media">
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="photo" src={PHOTO_BASE + main.path} alt="" loading={priority ? "eager" : "lazy"} width={main.w} height={main.h} />
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--ink-3)" }}><Icon name="car" size="lg" /></div>
        )}
        <div className="gc-vcard__tags">
          {tags.slice(0, 2).map((t) =>
            t === "reserved" ? <span key={t} className="gc-tag gc-tag--glass">שמור</span> : TAG[t] ? <span key={t} className={`gc-tag ${TAG[t].cls}`}>{TAG[t].label}</span> : null,
          )}
        </div>
        {car.photos.length > 1 && <span className="gc-vcard__count"><Icon name="image" size="sm" />{car.photos.length}</span>}
      </div>
      <div className="gc-vcard__body">
        <h3 className="gc-vcard__name">{car.title}{car.year ? ` · ${car.year}` : ""}</h3>
        <div className="gc-vcard__specs">
          {specs.slice(0, 3).map((s, i) => <span key={i}><Icon name={s.icon} size="sm" />{s.text}</span>)}
        </div>
        <div className="gc-vcard__foot">
          <div>
            <div className="gc-vcard__price">
              <span className="gc-num">{money(car.sale_price ?? car.price)}</span>
              {car.sale_price && car.price ? <span className="price-old gc-num">{money(car.price)}</span> : null}
            </div>
            {car.tags.includes("final_price") && <div className="gc-vcard__monthly">מחיר סופי, כולל העברת בעלות</div>}
          </div>
          <span className="gc-btn gc-btn--outline gc-btn--icon" aria-hidden="true"><Icon name="chevron-left" /></span>
        </div>
      </div>
    </Link>
  );
}
