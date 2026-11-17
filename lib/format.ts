// Formatting shared by both sides. Money is stored in agorot; everything shown is whole shekels.
const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const toAgorot = (shekels: number) => Math.round(shekels * 100);
export const toShekels = (agorot: number) => agorot / 100;
/** "₪ 84,900" — the sign before the number, as in the design system. */
export const money = (agorot: number | null | undefined) => (agorot == null ? "—" : `₪ ${nf.format(Math.round(agorot / 100))}`);
export const num = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
export const km = (n: number | null | undefined) => (n == null ? "—" : `${nf.format(n)} ק״מ`);
/** 052-852-8282 */
export function phone(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return p;
}
/** 123-45-678 or 12-345-67 */
export function plate(p: string): string {
  const d = p.replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  return d;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
/** 01.12.2026, short form 01.12 */
export function date(d: string | Date | null | undefined, short = false): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : d;
  return short ? `${pad2(x.getDate())}.${pad2(x.getMonth() + 1)}` : `${pad2(x.getDate())}.${pad2(x.getMonth() + 1)}.${x.getFullYear()}`;
}
export function daysSince(d: string | Date, now = new Date()): number {
  const x = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return Math.max(0, Math.floor((now.getTime() - x.getTime()) / 86_400_000));
}
/** Stock-age colour per the plan: neutral, orange over 60, red over 90. */
export const daysTone = (n: number) => (n > 90 ? "danger" : n > 60 ? "warn" : "");

export const FUEL: Record<string, string> = { petrol: "בנזין", diesel: "דיזל", hybrid: "היברידי", plugin: "פלאג-אין", electric: "חשמלי", gas: "גז" };
export const GEARBOX: Record<string, string> = { auto: "אוטומט", manual: "ידני", robotic: "רובוטי", cvt: "CVT" };
export const STATUS: Record<string, string> = { prep: "בהכנה", available: "זמין", reserved: "שמור", sold: "נמכר" };
export const OWNERSHIP: Record<string, string> = {
  rental: "השכרה", leasing: "ליסינג", company: "חברה", taxi: "מונית", driving_school: "לימוד נהיגה",
  government: "משרד ממשלתי", private_import: "יבוא אישי", other: "אחר",
};
export const ACCIDENT: Record<string, string> = { none: "ללא", minor: "קלה", structural: "פגיעה שלדתית", other: "אחר" };
export const PAY_METHOD: Record<string, string> = { cash: "מזומן", transfer: "העברה", check: "שיק", card: "אשראי", financing: "מימון", trade_in: "טרייד-אין" };
export const LEAD_STATUS: Record<string, string> = { new: "חדש", in_progress: "בטיפול", meeting: "נקבעה פגישה", won: "נסגר בעסקה", lost: "לא רלוונטי" };
export const SCRAP_STATUS: Record<string, string> = { new: "חדשה", quoted: "נשלחה הצעה", accepted: "התקבלה", collected: "נאסף", closed: "נסגר", rejected: "נדחתה" };
export const TAG: Record<string, { label: string; cls: string }> = {
  new: { label: "חדש במגרש", cls: "gc-tag--new" },
  sale: { label: "מבצע", cls: "gc-tag--sale" },
  first_hand: { label: "יד ראשונה", cls: "gc-tag--first" },
  final_price: { label: "מחיר סופי", cls: "gc-tag--glass" },
};
