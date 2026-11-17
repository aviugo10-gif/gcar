import type { PublicCar } from "./types";

// ---------- catalog filtering (shared by the page and the "show N cars" counter) ----------
export type CatalogQuery = { q?: string; make?: string; min?: string; max?: string; year?: string; km?: string; hand?: string; gearbox?: string; fuel?: string; sort?: string };

const HE_EN: Record<string, string> = {
  "מאזדה": "mazda", "טויוטה": "toyota", "קיה": "kia", "יונדאי": "hyundai", "סקודה": "skoda", "פיג׳ו": "peugeot", "שברולט": "chevrolet",
  "ניסאן": "nissan", "הונדה": "honda", "סוזוקי": "suzuki", "מיצובישי": "mitsubishi", "פולקסווגן": "volkswagen", "סיאט": "seat", "רנו": "renault", "שברולה": "chevrolet",
};
const norm = (s: string) => s.toLowerCase().replace(/[׳'"״\-]/g, "").replace(/\s+/g, " ").trim();
function haystack(c: PublicCar) {
  return norm(`${c.make} ${HE_EN[c.make] ?? ""} ${c.model} ${c.trim ?? ""} ${c.year ?? ""}`);
}
/** Tolerant: every word must appear, allowing one typo in words of 4+ letters. */
function matches(c: PublicCar, q: string) {
  const h = haystack(c);
  const words = h.split(" ");
  return norm(q).split(" ").filter(Boolean).every((w) => h.includes(w) || (w.length >= 4 && words.some((x) => editDistance1(x, w))));
}
function editDistance1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}

export function filterCatalog(cars: PublicCar[], q: CatalogQuery): PublicCar[] {
  const price = (c: PublicCar) => c.sale_price ?? c.price ?? 0;
  let out = cars.filter((c) => {
    if (q.q && !matches(c, q.q)) return false;
    if (q.make && c.make !== q.make) return false;
    if (q.min && price(c) < Number(q.min) * 100) return false;
    if (q.max && price(c) > Number(q.max) * 100) return false;
    if (q.year && (c.year ?? 0) < Number(q.year)) return false;
    if (q.km && (c.km ?? Infinity) > Number(q.km)) return false;
    if (q.hand && (c.hand ?? 99) > Number(q.hand)) return false;
    if (q.gearbox && c.gearbox !== q.gearbox) return false;
    if (q.fuel && c.fuel !== q.fuel) return false;
    return true;
  });
  const by: Record<string, (a: PublicCar, b: PublicCar) => number> = {
    new: (a, b) => Date.parse(b.published_at ?? "0") - Date.parse(a.published_at ?? "0"),
    price_asc: (a, b) => price(a) - price(b),
    price_desc: (a, b) => price(b) - price(a),
    year: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    km: (a, b) => (a.km ?? 1e9) - (b.km ?? 1e9),
  };
  if (q.sort && by[q.sort]) out = [...out].sort(by[q.sort]);
  return out;
}
