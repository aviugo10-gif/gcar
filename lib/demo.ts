// Seed data for demo mode (no Supabase yet). Mutations change this in-memory copy until the server restarts.
import type { Vehicle, Customer, Deal, Payment, Lead, ScrapRequest, VehicleExpense, ExpenseCategory, Settings, DealDoc } from "./types";
import vault from "./demo-vault.json";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const tsAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const photos = (key: string) => [0, 1, 2].map((i) => ({ id: `${key}-${i}`, path: `${key}-${i}.svg`, sort: i, is_main: i === 0, show_on_site: true, w: 1400, h: 1050 }));
const V = vault.prices as Record<string, { purchase: string; min: string }>;

function car(id: string, photo: string, v: Partial<Vehicle>, listing?: { tags?: string[]; sale?: number; text?: string; pinned?: boolean; daysPublished?: number }): Vehicle {
  const base: Vehicle = {
    id, plate: "", make: "", model: "", year: null, km: null, hand: null, accident: "none", status: "available",
    stock_in_date: daysAgo(10), listed_price: null, ownership_flags: [], equipment: [], photos: photos(photo),
    purchase_price_enc: V[id]?.purchase ?? null, min_price_enc: V[id]?.min ?? null, ...v,
  };
  base.listing = listing
    ? {
        vehicle_id: id, is_published: true, slug: `${photo}-${base.year}-${id}`, tags: listing.tags ?? [], sale_price: listing.sale ?? null,
        marketing_text: listing.text ?? null, pinned: !!listing.pinned, sort: 0,
        visible_fields: ["year", "km", "hand", "gearbox", "engine_cc", "fuel", "test_valid_until", "color"],
        published_at: tsAgo((listing.daysPublished ?? 20) * 1440),
      }
    : null;
  return base;
}

export const db = {
  vehicles: [
    car("v1", "mazda3", { plate: "12345678", make: "מאזדה", model: "3", trim: "Comfort", year: 2021, color: "אדום", fuel: "petrol", gearbox: "auto", engine_cc: 2000, km: 58000, hand: 1, test_valid_until: daysAgo(-140), listed_price: 8490000, stock_in_date: daysAgo(12), equipment: ["מצלמת רוורס", "Apple CarPlay", "בקרת שיוט אדפטיבית", "שמירת נתיב"] },
      { tags: [], pinned: true, daysPublished: 5, text: "יד ראשונה מפרטי, טיפולים בסוכנות עד היום. נהגה אחת, שמורה מאוד." }),
    car("v2", "corolla", { plate: "34512378", make: "טויוטה", model: "קורולה", trim: "Hybrid", year: 2020, color: "לבן", fuel: "hybrid", gearbox: "cvt", engine_cc: 1800, km: 92000, hand: 2, test_valid_until: daysAgo(-60), listed_price: 7250000, stock_in_date: daysAgo(33), equipment: ["מצלמת רוורס", "בקרת שיוט אדפטיבית", "מולטימדיה"] },
      { tags: ["sale", "final_price"], sale: 6990000 }),
    car("v3", "sportage", { plate: "7654321", make: "קיה", model: "ספורטאז׳", year: 2018, color: "אפור כהה", fuel: "petrol", gearbox: "auto", engine_cc: 1600, km: 121000, hand: 2, listed_price: 6200000, status: "prep", stock_in_date: daysAgo(74), ownership_flags: ["leasing"] }),
    car("v4", "i20", { plate: "23145698", make: "יונדאי", model: "i20", year: 2022, color: "כחול", fuel: "petrol", gearbox: "auto", engine_cc: 1000, km: 31000, hand: 1, test_valid_until: daysAgo(-300), listed_price: 6890000, stock_in_date: daysAgo(4), equipment: ["Android Auto", "Apple CarPlay", "חיישני חניה"] },
      { daysPublished: 3 }),
    car("v5", "octavia", { plate: "45632187", make: "סקודה", model: "אוקטביה", trim: "סטיישן", year: 2019, color: "אפור", fuel: "diesel", gearbox: "robotic", engine_cc: 1600, km: 148000, hand: 3, test_valid_until: daysAgo(-20), listed_price: 7990000, stock_in_date: daysAgo(64), ownership_flags: ["company"], equipment: ["וו גרירה", "חיישני חניה", "מושבים מחוממים"] },
      { tags: [] }),
    car("v6", "tucson", { plate: "56743218", make: "יונדאי", model: "טוסון", year: 2022, color: "לבן", fuel: "hybrid", gearbox: "auto", engine_cc: 1600, km: 45000, hand: 1, listed_price: 12490000, status: "reserved", reserved_for: "c2", reserved_until: daysAgo(-3), stock_in_date: daysAgo(21), equipment: ["גג נפתח", "מושבי עור", "מצלמת רוורס", "כניסה ללא מפתח"] },
      { tags: [] }),
    car("v7", "niro", { plate: "67854329", make: "קיה", model: "נירו", trim: "EV", year: 2023, color: "ירוק", fuel: "electric", gearbox: "auto", km: 22000, hand: 1, test_valid_until: daysAgo(-420), listed_price: 13200000, stock_in_date: daysAgo(8), ownership_flags: ["rental"], equipment: ["שמירת נתיב", "מערכת למניעת תאונות", "Apple CarPlay"] },
      { tags: [], daysPublished: 7 }),
    car("v8", "yaris", { plate: "78965430", make: "טויוטה", model: "יאריס", year: 2017, color: "צהוב", fuel: "petrol", gearbox: "auto", engine_cc: 1300, km: 132000, hand: 2, listed_price: 4790000, stock_in_date: daysAgo(96), accident: "minor", accident_notes: "פגיעה קלה בפגוש אחורי, תוקן" },
      { tags: ["sale"], sale: 4590000 }),
    car("v9", "i20", { plate: "11122233", make: "יונדאי", model: "i20", year: 2019, color: "לבן", fuel: "petrol", gearbox: "auto", km: 88000, hand: 2, listed_price: 6100000, status: "sold", stock_in_date: daysAgo(55) }),
  ] as Vehicle[],
  categories: [
    { id: "k1", name: "מכונאות", icon: "wrench", sort: 1 }, { id: "k2", name: "פחחות וצבע", icon: "brush", sort: 2 }, { id: "k3", name: "גיר", icon: "cog", sort: 3 },
    { id: "k4", name: "חשמל", icon: "zap", sort: 4 }, { id: "k5", name: "צמיגים", icon: "disc", sort: 5 }, { id: "k6", name: "ניקוי ופוליש", icon: "sparkles", sort: 6 },
    { id: "k7", name: "ריפוד", icon: "armchair", sort: 7 }, { id: "k8", name: "טסט ורישוי", icon: "file-text", sort: 8 }, { id: "k9", name: "גרירה", icon: "truck", sort: 9 },
    { id: "k10", name: "דלק", icon: "fuel", sort: 10 },
  ] as ExpenseCategory[],
  expenses: [
    { id: "e1", vehicle_id: "v1", category_id: "k6", amount: 45000, date: daysAgo(10), supplier: "שטיפת הדר" },
    { id: "e2", vehicle_id: "v1", category_id: "k5", amount: 160000, date: daysAgo(9), supplier: "צמיגי השרון" },
    { id: "e3", vehicle_id: "v3", category_id: "k2", amount: 380000, date: daysAgo(40), supplier: "מוסך אבי" },
    { id: "e4", vehicle_id: "v3", category_id: "k1", amount: 210000, date: daysAgo(20), supplier: "מוסך אבי" },
    { id: "e5", vehicle_id: "v5", category_id: "k8", amount: 120000, date: daysAgo(30) },
    { id: "e6", vehicle_id: "v9", category_id: "k1", amount: 90000, date: daysAgo(50) },
    { id: "e7", vehicle_id: "v8", category_id: "k2", amount: 250000, date: daysAgo(80), note: "פגוש אחורי" },
  ] as VehicleExpense[],
  customers: [
    { id: "c1", full_name: "יוסי לוי", phone: "0501234567", id_number_last4: "6789", email: null, address: "פתח תקווה", created_at: tsAgo(60 * 24 * 20) },
    { id: "c2", full_name: "מיכל אברהם", phone: "0547654321", id_number_last4: "1234", address: "ראש העין", created_at: tsAgo(60 * 24 * 3) },
    { id: "c3", full_name: "רון כהן", phone: "0529876543", created_at: tsAgo(60 * 24 * 40) },
  ] as Customer[],
  deals: [{ id: "d1", vehicle_id: "v9", customer_id: "c1", sale_price: 5990000, deal_date: daysAgo(15), status: "open" }] as Deal[],
  payments: [
    { id: "p1", deal_id: "d1", kind: "deposit", amount: 500000, method: "transfer", due_date: daysAgo(15), paid_at: daysAgo(15) },
    { id: "p2", deal_id: "d1", kind: "payment", amount: 3000000, method: "financing", due_date: daysAgo(12), paid_at: daysAgo(12) },
    { id: "p3", deal_id: "d1", kind: "payment", amount: 1000000, method: "check", due_date: daysAgo(4), paid_at: null, check_number: "100234" },
    { id: "p4", deal_id: "d1", kind: "payment", amount: 1490000, method: "check", due_date: daysAgo(-26), paid_at: null, check_number: "100235" },
  ] as Payment[],
  docs: [
    { id: "dd1", deal_id: "d1", type: "receipt", path: "demo.pdf" }, { id: "dd2", deal_id: "d1", type: "ownership_transfer", path: "demo.pdf" },
    { id: "dd3", deal_id: "d1", type: "disclosure", path: "demo.pdf", signed_at: tsAgo(60 * 24 * 15) },
  ] as DealDoc[],
  leads: [
    { id: "l1", kind: "vehicle", vehicle_id: "v1", name: "דנה", phone: "0521112233", message: "אפשר לבוא לראות מחר בבוקר?", status: "new", created_at: tsAgo(25) },
    { id: "l2", kind: "notify_me", name: "אלון", phone: "0533334444", message: "מחפש סקודה קודיאק 7 מקומות עד 120 אלף", status: "new", created_at: tsAgo(180) },
    { id: "l3", kind: "vehicle", vehicle_id: "v7", name: "שירה", phone: "0545556666", status: "in_progress", follow_up_at: tsAgo(-60 * 20), created_at: tsAgo(60 * 26) },
    { id: "l4", kind: "general", name: "משה", phone: "0507778888", message: "קונים גם רכבים? יש לי מאזדה 6 2016", status: "meeting", created_at: tsAgo(60 * 50) },
  ] as Lead[],
  scrap: [
    { id: "s1", plate: "5544332", make: "פיג׳ו", model: "206", year: 2007, km: 245000, answers: { starts: "לא", drives: "לא", keys: "כן", accident: "לא יודע", fire_flood: "לא", missing_parts: "לא", airbags: "לא", lien: "לא" }, photos: [], city: "כפר סבא", name: "אבי", phone: "0502223344", contact_pref: "whatsapp", promised_by: tsAgo(-18), status: "new", created_at: tsAgo(12) },
    { id: "s2", plate: "8877665", make: "שברולט", model: "ספארק", year: 2011, km: 190000, answers: { starts: "כן", drives: "כן", keys: "כן", accident: "כן", fire_flood: "לא", missing_parts: "לא", airbags: "כן", lien: "לא" }, photos: [], city: "הוד השרון", name: "נועה", phone: "0549990000", contact_pref: "call", status: "quoted", quote_amount: 180000, quoted_at: tsAgo(60 * 5), quote_valid_until: daysAgo(-6), created_at: tsAgo(60 * 6) },
  ] as ScrapRequest[],
  settings: {
    business: { name: "gcar", tagline: "קנייה | מכירה | שירותי רכב", phone: "0528528282", whatsapp: "972528528282", email: null, address: null, lat: null, lng: null, vat_rate: 18 },
    hours: { sun: ["09:00", "19:00"], mon: ["09:00", "19:00"], tue: ["09:00", "19:00"], wed: ["09:00", "19:00"], thu: ["09:00", "19:00"], fri: ["09:00", "13:00"], sat: null },
    home: { headline: "רכב טוב, מחיר הוגן, בלי הפתעות", sub: "כל רכב במגרש נבדק ומגיע עם היסטוריה מלאה. בואו לראות, לנסוע ולהחליט בשקט." },
    scrap: { promise_enabled: true, promise_minutes: 30 },
    legal: { accessibility_coordinator: { name: null, phone: null, email: null }, last_audit: null },
    contact: { waze: null, maps: null },
  } as Settings,
  holidays: [] as string[],
  vault: vault.record,
  business_expenses: vault.business_expenses,
  other_income: vault.other_income,
};

let n = 100;
export const newId = (p: string) => `${p}${++n}`;
