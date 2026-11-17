"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDemo } from "@/lib/env";
import { verify, DEMO_COOKIE } from "@/lib/server/demo-auth";
import { supabaseServer } from "@/lib/supabase/server";
import * as A from "@/lib/data/admin";
import { lookupPlate, demoLookup, GOV_OWNERSHIP } from "@/lib/gov";
import type { VaultRecord } from "@/lib/vault";
import { isValidIsraeliId, isValidPhone, normalizePhone } from "@/lib/il";

/** Every action re-checks the session (both factors). RLS checks again in the database. */
async function requireStaff() {
  if (isDemo) {
    if (!verify((await cookies()).get(DEMO_COOKIE)?.value)) throw new Error("unauthorized");
    return;
  }
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!user || aal?.currentLevel !== "aal2") throw new Error("unauthorized");
}
const ok = <T,>(data?: T) => ({ ok: true as const, data });
const fail = (error: string) => ({ ok: false as const, error });

export async function signOut() {
  if (isDemo) (await cookies()).delete(DEMO_COOKIE);
  else await (await supabaseServer()).auth.signOut();
}

// ---------- vehicles ----------
export async function plateLookup(plate: string) {
  await requireStaff();
  const n = plate.replace(/\D/g, "");
  const existing = await A.findVehicleByPlate(n);
  if (existing) return ok({ existing: existing.id, gov: null });
  const gov = (await lookupPlate(n)) ?? (isDemo ? demoLookup(n) : null);
  return ok({ existing: null, gov: gov ? { ...gov, ownership_flag: gov.ownership ? GOV_OWNERSHIP[gov.ownership] ?? null : null } : null });
}

const NewVehicle = z.object({
  plate: z.string().regex(/^\d{5,8}$/),
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(60),
  trim: z.string().max(60).nullish(),
  year: z.number().int().min(1950).max(2100).nullish(),
  color: z.string().max(30).nullish(),
  fuel: z.enum(["petrol", "diesel", "hybrid", "plugin", "electric", "gas"]).nullish(),
  gearbox: z.enum(["auto", "manual", "robotic", "cvt"]).nullish(),
  km: z.number().int().min(0).max(2_000_000).nullish(),
  hand: z.number().int().min(0).max(30).nullish(),
  test_valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  listed_price: z.number().int().min(0).nullish(),
  purchase_price_enc: z.string().regex(/^v1\./).nullish(),
  ownership_flags: z.array(z.string()).default([]),
  gov_data: z.unknown().optional(),
});
export async function createVehicle(input: z.input<typeof NewVehicle>) {
  await requireStaff();
  const p = NewVehicle.safeParse(input);
  if (!p.success) return fail("חסרים פרטים: " + p.error.issues.map((i) => i.path.join(".")).join(", "));
  const { gov_data, ...v } = p.data;
  const id = await A.createVehicle({ ...v, ...(gov_data ? { gov_data: gov_data as never } : {}) } as A.VehicleInput);
  revalidatePath("/admin");
  return ok({ id });
}

const VehiclePatch = NewVehicle.partial().extend({
  engine_cc: z.number().int().min(0).max(10000).nullish(),
  accident: z.enum(["none", "minor", "structural", "other"]).optional(),
  accident_notes: z.string().max(500).nullish(),
  notes: z.string().max(2000).nullish(),
  equipment: z.array(z.string()).optional(),
  min_price_enc: z.string().regex(/^v1\./).nullish(),
});
export async function updateVehicle(id: string, patch: z.input<typeof VehiclePatch>) {
  await requireStaff();
  const p = VehiclePatch.safeParse(patch);
  if (!p.success) return fail("ערך לא תקין");
  await A.updateVehicle(id, p.data as A.VehicleInput);
  revalidatePath(`/admin/inventory/${id}`);
  revalidatePath("/admin/inventory");
  return ok();
}
export async function setVehicleStatus(id: string, status: "prep" | "available" | "reserved", reservedFor?: string, reservedUntil?: string) {
  await requireStaff();
  if (status === "reserved" && !reservedFor) return fail("רכב שמור צריך לקוח");
  await A.setStatus(id, status, reservedFor, reservedUntil);
  revalidatePath("/admin", "layout");
  return ok();
}
export async function savePhotos(vehicleId: string, photos: { id: string; sort: number; is_main: boolean; show_on_site: boolean }[]) {
  await requireStaff();
  if (photos.filter((p) => p.is_main).length > 1) return fail("רק תמונה ראשית אחת");
  await A.savePhotoOrder(vehicleId, photos);
  revalidatePath(`/admin/inventory/${vehicleId}`);
  revalidatePath("/", "layout");
  return ok();
}
export async function removePhoto(vehicleId: string, photoId: string) {
  await requireStaff();
  await A.deletePhoto(vehicleId, photoId);
  revalidatePath(`/admin/inventory/${vehicleId}`);
  return ok();
}
/** Photo upload: signed URL into vehicle-photos, then the row. Demo: stores a placeholder. */
export async function photoUploadUrl(vehicleId: string) {
  await requireStaff();
  if (isDemo) return ok({ demo: true as const, path: "", url: "" });
  const path = `${vehicleId}/${crypto.randomUUID()}.jpg`;
  const { data, error } = await (await supabaseServer()).storage.from("vehicle-photos").createSignedUploadUrl(path);
  if (error) return fail("upload");
  return ok({ demo: false as const, path, url: data.signedUrl });
}
export async function attachPhoto(vehicleId: string, path: string, w?: number, h?: number) {
  await requireStaff();
  await A.addPhoto(vehicleId, isDemo && !path ? "corolla-2.svg" : path, w, h);
  revalidatePath(`/admin/inventory/${vehicleId}`);
  return ok();
}

export async function saveListing(vehicleId: string, l: { is_published?: boolean; marketing_text?: string | null; sale_price?: number | null; tags?: string[]; visible_fields?: string[]; pinned?: boolean }) {
  await requireStaff();
  if (l.is_published) {
    const v = await A.getVehicle(vehicleId);
    const missing = [!v?.photos.some((p) => p.is_main) && "תמונה ראשית", !v?.listed_price && "מחיר", v?.status === "prep" && "סטטוס זמין"].filter(Boolean);
    if (missing.length) return fail("לפני פרסום חסר: " + missing.join(", "));
  }
  await A.saveListing(vehicleId, l);
  revalidatePath("/", "layout");
  return ok();
}

// ---------- prices (ciphertext only) ----------
export async function saveEncPrices(vehicleId: string, purchase?: string, min?: string) {
  await requireStaff();
  await A.saveEncPrices(vehicleId, purchase, min);
  revalidatePath(`/admin/inventory/${vehicleId}`);
  return ok();
}

// ---------- expenses ----------
const Expense = z.object({ vehicle_id: z.string(), category_id: z.string(), amount: z.number().int().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), supplier: z.string().max(60).nullish(), note: z.string().max(300).nullish() });
export async function addExpense(e: z.input<typeof Expense>) {
  await requireStaff();
  const p = Expense.safeParse(e);
  if (!p.success) return fail("סכום לא תקין");
  const id = await A.addExpense(p.data);
  revalidatePath(`/admin/inventory/${e.vehicle_id}`);
  return ok({ id });
}
export async function deleteExpense(id: string, vehicleId: string, restore = false, copy?: z.input<typeof Expense>) {
  await requireStaff();
  if (isDemo && restore && copy) await A.addExpense(copy);
  else await A.deleteExpense(id, restore);
  revalidatePath(`/admin/inventory/${vehicleId}`);
  return ok();
}

// ---------- customers & deals ----------
const NewCustomer = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().refine(isValidPhone, "phone"),
  id_number: z.string().optional().refine((v) => !v || isValidIsraeliId(v), "id"),
  email: z.string().email().nullish().or(z.literal("")),
  address: z.string().max(120).nullish(),
  notes: z.string().max(1000).nullish(),
});
export async function createCustomer(c: z.input<typeof NewCustomer>) {
  await requireStaff();
  const p = NewCustomer.safeParse(c);
  if (!p.success) return fail(p.error.issues[0].message === "id" ? "מספר תעודת הזהות לא תקין (ספרת ביקורת)" : p.error.issues[0].message === "phone" ? "טלפון לא תקין" : "חסרים פרטים");
  const existing = (await A.listCustomers()).find((x) => x.phone === normalizePhone(p.data.phone));
  if (existing) return ok({ id: existing.id, duplicate: true });
  const id = await A.createCustomer({ ...p.data, phone: normalizePhone(p.data.phone), email: p.data.email || null });
  revalidatePath("/admin/customers");
  return ok({ id, duplicate: false });
}
const NewDeal = z.object({
  vehicle_id: z.string(), customer_id: z.string(), sale_price: z.number().int().positive(), deal_date: z.string(),
  trade_in_value: z.number().int().min(0).nullish(), notes: z.string().max(1000).nullish(),
  deposit: z.object({ amount: z.number().int().positive(), method: z.enum(["cash", "transfer", "check", "card", "financing", "trade_in"]) }).nullish(),
});
export async function createDeal(d: z.input<typeof NewDeal>) {
  await requireStaff();
  const p = NewDeal.safeParse(d);
  if (!p.success) return fail("חסרים פרטים בעסקה");
  const { deposit, ...deal } = p.data;
  const id = await A.createDeal(deal, deposit ? { kind: "deposit", amount: deposit.amount, method: deposit.method, due_date: deal.deal_date, paid_at: deal.deal_date } : undefined);
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return ok({ id });
}
const NewPayment = z.object({ deal_id: z.string(), amount: z.number().int().positive(), method: z.enum(["cash", "transfer", "check", "card", "financing", "trade_in"]), due_date: z.string(), paid: z.boolean(), check_number: z.string().max(20).nullish() });
export async function addPayment(p0: z.input<typeof NewPayment>) {
  await requireStaff();
  const p = NewPayment.safeParse(p0);
  if (!p.success) return fail("סכום לא תקין");
  const { paid, ...rest } = p.data;
  await A.addPayment({ ...rest, kind: "payment", paid_at: paid ? new Date().toISOString().slice(0, 10) : null });
  revalidatePath(`/admin/deals/${p.data.deal_id}`);
  return ok();
}
export async function markPaid(paymentId: string, dealId: string, paid: boolean) {
  await requireStaff();
  await A.markPaid(paymentId, paid);
  revalidatePath(`/admin/deals/${dealId}`);
  revalidatePath("/admin");
  return ok();
}

// ---------- inbox ----------
export async function setLeadStatus(id: string, status: "new" | "in_progress" | "meeting" | "won" | "lost") {
  await requireStaff();
  await A.updateLead(id, { status });
  revalidatePath("/admin/inbox");
  return ok();
}
export async function sendScrapQuote(id: string, amount: number, validDays = 7) {
  await requireStaff();
  if (!Number.isInteger(amount) || amount <= 0) return fail("סכום לא תקין");
  await A.updateScrap(id, { status: "quoted", quote_amount: amount, quoted_at: new Date().toISOString(), quote_valid_until: new Date(Date.now() + validDays * 86_400_000).toISOString().slice(0, 10) });
  revalidatePath("/admin/inbox");
  return ok();
}
export async function setScrapStatus(id: string, status: "new" | "quoted" | "accepted" | "collected" | "closed" | "rejected") {
  await requireStaff();
  await A.updateScrap(id, { status });
  revalidatePath("/admin/inbox");
  return ok();
}

// ---------- vault & finance ----------
export async function getVault() {
  await requireStaff();
  return A.getVaultRecord();
}
export async function setupVault(record: VaultRecord) {
  await requireStaff();
  if (!isDemo && (await A.getVaultRecord())) return fail("הכספת כבר הוגדרה");
  await A.saveVaultRecord(record);
  return ok();
}
/** Finance needs a fresh second factor (TOTP in the last 10 minutes), not just the session's sign-in code. */
async function requireRecentOtp() {
  if (isDemo) return;
  const sb = await supabaseServer();
  const { data: { session } } = await sb.auth.getSession();
  const payload = session ? JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString()) : null;
  const totp = (payload?.amr as { method: string; timestamp: number }[] | undefined)?.find((a) => a.method === "totp");
  if (!totp || Date.now() / 1000 - totp.timestamp > 600) throw new Error("otp_required");
}
export async function financeRows() {
  await requireStaff();
  await requireRecentOtp();
  const [vehicles, deals, expenses, be, oi] = await Promise.all([A.listVehicles(), A.listDeals(), A.listExpenses(), A.listEnc("business_expenses"), A.listEnc("other_income")]);
  return {
    vehicles: vehicles.map((v) => ({ id: v.id, title: `${v.make} ${v.model} ${v.year ?? ""}`.trim(), status: v.status, stock_in_date: v.stock_in_date, purchase_price_enc: v.purchase_price_enc ?? null, listed_price: v.listed_price })),
    deals: deals.filter((d) => d.status !== "cancelled").map((d) => ({ id: d.id, vehicle_id: d.vehicle_id, sale_price: d.sale_price, deal_date: d.deal_date })),
    expenses: expenses.map((e) => ({ vehicle_id: e.vehicle_id, amount: e.amount, date: e.date, category_id: e.category_id })),
    business_expenses: be,
    other_income: oi,
  };
}
export async function addFinanceRow(table: "business_expenses" | "other_income", month: string, payload_enc: string) {
  await requireStaff();
  if (!/^\d{4}-\d{2}-01$/.test(month)) return fail("חודש לא תקין");
  await A.addEnc(table, month, payload_enc);
  revalidatePath("/admin/finance");
  return ok();
}

// ---------- OCR (vehicle licence and other documents) ----------
export async function ocrDocument(form: FormData) {
  await requireStaff();
  const file = form.get("image");
  const docType = String(form.get("docType") ?? "vehicle_license") as import("@/lib/ocr").DocType;
  if (!(file instanceof File) || file.size > 8_000_000 || !/^image\/(jpeg|png|webp|heic)$/.test(file.type)) return fail("תמונה לא תקינה");
  const { getProvider } = await import("@/lib/ocr");
  const provider = await getProvider();
  try {
    const r = await provider.extract({ bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type }, docType);
    return ok({ provider: r.provider, fields: Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, v.value])) as Record<string, string> });
  } catch {
    return fail("לא הצלחנו לקרוא את המסמך. אפשר להקליד את מספר הרכב.");
  }
}

// ---------- deal documents (private bucket, short-lived links) ----------
const DOC_TYPES = ["receipt", "car_book", "inspection", "ownership_transfer", "agreement", "disclosure", "other"] as const;
export async function docUploadUrl(dealId: string, type: (typeof DOC_TYPES)[number], ext: "pdf" | "jpg") {
  await requireStaff();
  if (!DOC_TYPES.includes(type)) return fail("סוג מסמך לא תקין");
  if (isDemo) return ok({ demo: true as const, path: "demo.pdf", url: "" });
  const path = `${dealId}/${type}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await (await supabaseServer()).storage.from("deal-docs").createSignedUploadUrl(path);
  if (error) return fail("upload");
  return ok({ demo: false as const, path, url: data.signedUrl });
}
export async function attachDoc(dealId: string, type: (typeof DOC_TYPES)[number], path: string) {
  await requireStaff();
  await A.addDoc(dealId, type, path);
  revalidatePath(`/admin/deals/${dealId}`);
  return ok();
}
export async function docViewUrl(path: string) {
  await requireStaff();
  if (isDemo) return ok({ url: "" });
  const { data, error } = await (await supabaseServer()).storage.from("deal-docs").createSignedUrl(path, 60);
  if (error) return fail("לא נמצא");
  return ok({ url: data.signedUrl });
}
/** New vault password (needs the recovery code, checked in the browser). The data key itself does not change. */
export async function changeVaultPassword(record: VaultRecord) {
  await requireStaff();
  await requireRecentOtp();
  const cur = await A.getVaultRecord();
  if (!cur || cur.check_value !== record.check_value) return fail("הכספת לא תואמת");
  await A.saveVaultRecord(record);
  return ok();
}
