import { SITE_URL } from "./env";
import { toWhatsApp } from "./il";
/** wa.me link with a ready message naming the car and its link, so the owner knows exactly which car it is. */
export function waLink(phone: string, car?: { title: string; year?: number | null; slug?: string }) {
  const text = car
    ? `היי, אני מתעניין/ת ב${car.title}${car.year ? ` ${car.year}` : ""} שראיתי באתר gcar${car.slug ? ` — ${SITE_URL}/cars/${car.slug}` : ""}`
    : "היי, הגעתי מהאתר של gcar";
  return `https://wa.me/${toWhatsApp(phone)}?text=${encodeURIComponent(text)}`;
}
