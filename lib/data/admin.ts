import "server-only";
import { isDemo } from "../env";
import { db, newId } from "../demo";
import { supabaseServer } from "../supabase/server";
import type { Vehicle, Customer, Deal, Payment, DealDoc, DealBalance, Lead, ScrapRequest, VehicleExpense, ExpenseCategory, EncRow, Listing } from "../types";
import type { VaultRecord } from "../vault";

// Every Supabase call here runs as the signed-in owner, so RLS (staff + second factor) guards it again at the database.
const sb = () => supabaseServer();
function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
const VEHICLE_SELECT =
  "*, ownership_flags:vehicle_ownership_flags(flag), equipment:vehicle_equipment(equipment_items(name)), photos:vehicle_photos(*), listing:catalog_listings(*)";
type VehicleRow = Omit<Vehicle, "ownership_flags" | "equipment"> & { ownership_flags: { flag: string }[]; equipment: { equipment_items: { name: string } }[] };
const mapVehicle = (r: VehicleRow): Vehicle => ({
  ...r,
  ownership_flags: r.ownership_flags.map((f) => f.flag),
  equipment: r.equipment.map((e) => e.equipment_items.name),
  photos: [...r.photos].sort((a, b) => a.sort - b.sort),
  listing: Array.isArray(r.listing) ? (r.listing[0] ?? null) : r.listing,
});

// ---------- vehicles ----------
export async function listVehicles(): Promise<Vehicle[]> {
  if (isDemo) return db.vehicles;
  const rows = must(await (await sb()).from("vehicles").select(VEHICLE_SELECT).is("deleted_at", null).order("stock_in_date", { ascending: false }));
  return (rows as VehicleRow[]).map(mapVehicle);
}
export async function getVehicle(id: string): Promise<Vehicle | null> {
  if (isDemo) return db.vehicles.find((v) => v.id === id) ?? null;
  const r = await (await sb()).from("vehicles").select(VEHICLE_SELECT).eq("id", id).maybeSingle();
  return r.data ? mapVehicle(r.data as VehicleRow) : null;
}
export async function findVehicleByPlate(plate: string): Promise<Vehicle | null> {
  if (isDemo) return db.vehicles.find((v) => v.plate === plate) ?? null;
  const r = await (await sb()).from("vehicles").select("id").eq("plate", plate).is("deleted_at", null).maybeSingle();
  return r.data ? getVehicle((r.data as { id: string }).id) : null;
}

export type VehicleInput = Partial<Omit<Vehicle, "id" | "photos" | "listing" | "ownership_flags" | "equipment">> & { ownership_flags?: string[]; equipment?: string[] };

export async function createVehicle(input: VehicleInput): Promise<string> {
  if (isDemo) {
    const id = newId("v");
    db.vehicles.unshift({
      id, plate: input.plate ?? "", make: input.make ?? "", model: input.model ?? "", year: input.year ?? null, km: input.km ?? null,
      hand: input.hand ?? null, accident: "none", status: "prep", stock_in_date: new Date().toISOString().slice(0, 10),
      listed_price: input.listed_price ?? null, ownership_flags: input.ownership_flags ?? [], equipment: input.equipment ?? [], photos: [], ...stripLists(input),
    } as Vehicle);
    return id;
  }
  const s = await sb();
  const { ownership_flags, equipment, ...row } = input;
  const v = must(await s.from("vehicles").insert(row).select("id").single()) as { id: string };
  if (ownership_flags?.length) must(await s.from("vehicle_ownership_flags").insert(ownership_flags.map((flag) => ({ vehicle_id: v.id, flag }))));
  if (equipment?.length) await setEquipment(v.id, equipment);
  return v.id;
}
const stripLists = ({ ownership_flags: _o, equipment: _e, ...rest }: VehicleInput) => rest;

export async function updateVehicle(id: string, input: VehicleInput): Promise<void> {
  if (isDemo) {
    const v = db.vehicles.find((x) => x.id === id);
    if (!v) throw new Error("not found");
    Object.assign(v, stripLists(input));
    if (input.ownership_flags) v.ownership_flags = input.ownership_flags;
    if (input.equipment) v.equipment = input.equipment;
    return;
  }
  const s = await sb();
  const { ownership_flags, equipment, ...row } = input;
  if (Object.keys(row).length) must(await s.from("vehicles").update(row).eq("id", id));
  if (ownership_flags) {
    must(await s.from("vehicle_ownership_flags").delete().eq("vehicle_id", id));
    if (ownership_flags.length) must(await s.from("vehicle_ownership_flags").insert(ownership_flags.map((flag) => ({ vehicle_id: id, flag }))));
  }
  if (equipment) await setEquipment(id, equipment);
}
async function setEquipment(vehicleId: string, names: string[]) {
  const s = await sb();
  const items = must(await s.from("equipment_items").select("id,name").in("name", names)) as { id: string; name: string }[];
  must(await s.from("vehicle_equipment").delete().eq("vehicle_id", vehicleId));
  if (items.length) must(await s.from("vehicle_equipment").insert(items.map((i) => ({ vehicle_id: vehicleId, item_id: i.id }))));
}

export async function setStatus(id: string, status: Vehicle["status"], reservedFor?: string, reservedUntil?: string) {
  if (status === "sold") throw new Error("נמכר נקבע רק דרך עסקה");
  return updateVehicle(id, { status, reserved_for: reservedFor ?? null, reserved_until: reservedUntil ?? null });
}

export async function listEquipment(): Promise<string[]> {
  if (isDemo) return ["מצלמת רוורס", "חיישני חניה", "מולטימדיה", "Apple CarPlay", "Android Auto", "בקרת שיוט", "בקרת שיוט אדפטיבית", "שמירת נתיב", "מערכת למניעת תאונות", "גג נפתח", "מושבי עור", "מושבים מחוממים", "חלונות חשמל", "מראות מתקפלות", "ג׳אנטים", "פנסי LED", "כניסה ללא מפתח", "מיזוג מפוצל", "וו גרירה", "7 מקומות"];
  return (must(await (await sb()).from("equipment_items").select("name").order("sort")) as { name: string }[]).map((r) => r.name);
}

// ---------- photos ----------
export async function savePhotoOrder(vehicleId: string, photos: { id: string; sort: number; is_main: boolean; show_on_site: boolean }[]) {
  if (isDemo) {
    const v = db.vehicles.find((x) => x.id === vehicleId);
    if (!v) return;
    for (const p of photos) Object.assign(v.photos.find((x) => x.id === p.id) ?? {}, p);
    v.photos.sort((a, b) => a.sort - b.sort);
    return;
  }
  const s = await sb();
  // clear main first: the unique index allows one main photo per car
  must(await s.from("vehicle_photos").update({ is_main: false }).eq("vehicle_id", vehicleId));
  for (const p of photos) must(await s.from("vehicle_photos").update({ sort: p.sort, is_main: p.is_main, show_on_site: p.show_on_site }).eq("id", p.id));
}
export async function addPhoto(vehicleId: string, path: string, w?: number, h?: number) {
  if (isDemo) {
    const v = db.vehicles.find((x) => x.id === vehicleId)!;
    v.photos.push({ id: newId("ph"), path, sort: v.photos.length, is_main: v.photos.length === 0, show_on_site: true, w, h });
    return;
  }
  const s = await sb();
  const count = (await s.from("vehicle_photos").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId)).count ?? 0;
  must(await s.from("vehicle_photos").insert({ vehicle_id: vehicleId, path, sort: count, is_main: count === 0, w, h }));
}
export async function deletePhoto(vehicleId: string, photoId: string) {
  if (isDemo) {
    const v = db.vehicles.find((x) => x.id === vehicleId)!;
    v.photos = v.photos.filter((p) => p.id !== photoId);
    if (v.photos.length && !v.photos.some((p) => p.is_main)) v.photos[0].is_main = true;
    return;
  }
  must(await (await sb()).from("vehicle_photos").delete().eq("id", photoId));
}

// ---------- listing ----------
export async function saveListing(vehicleId: string, l: Partial<Listing>) {
  if (isDemo) {
    const v = db.vehicles.find((x) => x.id === vehicleId)!;
    const slug = l.slug ?? v.listing?.slug ?? `${v.make}-${v.model}-${v.year}-${v.id}`.replace(/\s+/g, "-");
    v.listing = {
      vehicle_id: vehicleId, is_published: false, tags: [], visible_fields: ["year", "km", "hand", "gearbox", "engine_cc", "fuel", "test_valid_until", "color"],
      pinned: false, sort: 0, ...v.listing, ...l, slug,
      published_at: l.is_published && !v.listing?.published_at ? new Date().toISOString() : v.listing?.published_at ?? null,
    };
    return;
  }
  const s = await sb();
  const existing = (await s.from("catalog_listings").select("slug,published_at").eq("vehicle_id", vehicleId).maybeSingle()).data as { slug: string; published_at: string | null } | null;
  const v = await getVehicle(vehicleId);
  const slug = existing?.slug ?? slugify(`${v?.make}-${v?.model}-${v?.year}`) + "-" + vehicleId.slice(0, 6);
  must(
    await s.from("catalog_listings").upsert({
      vehicle_id: vehicleId, slug, ...l,
      published_at: l.is_published && !existing?.published_at ? new Date().toISOString() : existing?.published_at ?? null,
    }),
  );
}
const TRANSLIT: Record<string, string> = { א: "a", ב: "b", ג: "g", ד: "d", ה: "h", ו: "v", ז: "z", ח: "h", ט: "t", י: "i", כ: "k", ך: "k", ל: "l", מ: "m", ם: "m", נ: "n", ן: "n", ס: "s", ע: "a", פ: "p", ף: "f", צ: "tz", ץ: "tz", ק: "k", ר: "r", ש: "sh", ת: "t" };
export const slugify = (s: string) => s.split("").map((c) => TRANSLIT[c] ?? c).join("").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------- expenses ----------
export async function listCategories(): Promise<ExpenseCategory[]> {
  if (isDemo) return db.categories;
  return must(await (await sb()).from("expense_categories").select("id,name,icon,sort").is("deleted_at", null).order("sort")) as ExpenseCategory[];
}
export async function listExpenses(vehicleId?: string): Promise<VehicleExpense[]> {
  if (isDemo) return db.expenses.filter((e) => !vehicleId || e.vehicle_id === vehicleId);
  let q = (await sb()).from("vehicle_expenses").select("id,vehicle_id,category_id,amount,date,note,supplier:suppliers(name)").is("deleted_at", null);
  if (vehicleId) q = q.eq("vehicle_id", vehicleId);
  const rows = must(await q.order("date", { ascending: false })) as unknown as (Omit<VehicleExpense, "supplier"> & { supplier: { name: string } | null })[];
  return rows.map((r) => ({ ...r, supplier: r.supplier?.name ?? null }));
}
export async function addExpense(e: Omit<VehicleExpense, "id">): Promise<string> {
  if (isDemo) {
    const id = newId("e");
    db.expenses.unshift({ ...e, id });
    return id;
  }
  const s = await sb();
  let supplier_id: string | null = null;
  if (e.supplier) {
    const sup = must(await s.from("suppliers").upsert({ name: e.supplier }, { onConflict: "name" }).select("id").single()) as { id: string };
    supplier_id = sup.id;
  }
  const r = must(await s.from("vehicle_expenses").insert({ vehicle_id: e.vehicle_id, category_id: e.category_id, amount: e.amount, date: e.date, note: e.note, supplier_id }).select("id").single()) as { id: string };
  return r.id;
}
export async function deleteExpense(id: string, restore = false) {
  if (isDemo) {
    if (restore) return; // demo: undo keeps a copy client-side
    db.expenses = db.expenses.filter((e) => e.id !== id);
    return;
  }
  must(await (await sb()).from("vehicle_expenses").update({ deleted_at: restore ? null : new Date().toISOString() }).eq("id", id));
}
export async function suppliers(): Promise<string[]> {
  if (isDemo) return [...new Set(db.expenses.map((e) => e.supplier).filter(Boolean) as string[])];
  return (must(await (await sb()).from("suppliers").select("name").order("name")) as { name: string }[]).map((r) => r.name);
}

// ---------- customers & deals ----------
export async function listCustomers(): Promise<(Customer & { debt: number; overdue: number })[]> {
  const [cs, deals, bal] = await Promise.all([rawCustomers(), listDeals(), balances()]);
  return cs.map((c) => {
    const mine = deals.filter((d) => d.customer_id === c.id && d.status !== "cancelled");
    const b = mine.map((d) => bal.find((x) => x.deal_id === d.id)).filter(Boolean) as DealBalance[];
    return { ...c, debt: b.reduce((s, x) => s + x.outstanding, 0), overdue: b.reduce((s, x) => s + x.overdue_count, 0) };
  });
}
async function rawCustomers(): Promise<Customer[]> {
  if (isDemo) return db.customers;
  return must(await (await sb()).from("customers").select("id,full_name,phone,phone_alt,id_number_last4,email,address,notes,created_at").is("deleted_at", null).order("created_at", { ascending: false })) as Customer[];
}
export async function getCustomer(id: string): Promise<Customer | null> {
  return (await rawCustomers()).find((c) => c.id === id) ?? null;
}
export async function createCustomer(c: Omit<Customer, "id" | "created_at"> & { id_number?: string }): Promise<string> {
  const { id_number, ...rest } = c;
  if (isDemo) {
    const id = newId("c");
    db.customers.unshift({ ...rest, id, created_at: new Date().toISOString(), id_number_last4: id_number?.slice(-4) ?? null });
    return id;
  }
  const idFields = id_number ? await protectIdNumber(id_number) : {};
  const r = must(await (await sb()).from("customers").insert({ ...rest, ...idFields }).select("id").single()) as { id: string };
  return r.id;
}
/** ID numbers: AES-GCM with a server key from the environment (not in the DB), HMAC for exact search, last 4 for display. */
async function protectIdNumber(idNumber: string) {
  const { createCipheriv, createHmac, randomBytes } = await import("node:crypto");
  const key = Buffer.from(process.env.ID_NUMBER_KEY ?? "", "base64");
  const hkey = Buffer.from(process.env.ID_NUMBER_HMAC_KEY ?? "", "base64");
  if (key.length !== 32 || hkey.length !== 32) throw new Error("ID_NUMBER_KEY / ID_NUMBER_HMAC_KEY not configured");
  const d = idNumber.replace(/\D/g, "").padStart(9, "0");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(d, "utf8"), c.final(), c.getAuthTag()]);
  return { id_number_enc: Buffer.concat([iv, ct]).toString("base64"), id_number_hmac: createHmac("sha256", hkey).update(d).digest("hex"), id_number_last4: d.slice(-4) };
}

export async function listDeals(): Promise<Deal[]> {
  if (isDemo) return db.deals;
  return must(await (await sb()).from("deals").select("*").is("deleted_at", null).order("deal_date", { ascending: false })) as Deal[];
}
export async function balances(): Promise<DealBalance[]> {
  if (isDemo)
    return db.deals.map((d) => {
      const ps = db.payments.filter((p) => p.deal_id === d.id);
      const paid = ps.filter((p) => p.paid_at).reduce((s, p) => s + p.amount, 0);
      const today = new Date().toISOString().slice(0, 10);
      const open = ps.filter((p) => !p.paid_at).sort((a, b) => a.due_date.localeCompare(b.due_date));
      return { deal_id: d.id, sale_price: d.sale_price, paid, outstanding: d.sale_price - paid, overdue_count: open.filter((p) => p.due_date < today).length, next_due: open[0]?.due_date ?? null };
    });
  return must(await (await sb()).from("deal_balance").select("*")) as DealBalance[];
}
export async function getDeal(id: string) {
  const deals = await listDeals();
  const deal = deals.find((d) => d.id === id);
  if (!deal) return null;
  const [vehicle, customer, payments, docs, bal] = await Promise.all([getVehicle(deal.vehicle_id), getCustomer(deal.customer_id), listPayments(id), listDocs(id), balances()]);
  return { deal, vehicle, customer, payments, docs, balance: bal.find((b) => b.deal_id === id)! };
}
export async function listPayments(dealId?: string): Promise<Payment[]> {
  if (isDemo) return db.payments.filter((p) => !dealId || p.deal_id === dealId);
  let q = (await sb()).from("deal_payments").select("*").is("deleted_at", null);
  if (dealId) q = q.eq("deal_id", dealId);
  return must(await q.order("due_date")) as Payment[];
}
export async function addDoc(dealId: string, type: DealDoc["type"], path: string) {
  if (isDemo) {
    db.docs.push({ id: newId("dd"), deal_id: dealId, type, path });
    return;
  }
  must(await (await sb()).from("deal_documents").insert({ deal_id: dealId, type, path }));
}
async function listDocs(dealId: string): Promise<DealDoc[]> {
  if (isDemo) return db.docs.filter((d) => d.deal_id === dealId);
  return must(await (await sb()).from("deal_documents").select("*").eq("deal_id", dealId)) as DealDoc[];
}
export async function createDeal(d: Omit<Deal, "id" | "status">, firstPayment?: Omit<Payment, "id" | "deal_id">): Promise<string> {
  if (isDemo) {
    const id = newId("d");
    db.deals.unshift({ ...d, id, status: "open" });
    const v = db.vehicles.find((x) => x.id === d.vehicle_id);
    if (v) {
      v.status = "sold";
      if (v.listing) v.listing.is_published = false;
    }
    if (firstPayment) db.payments.push({ ...firstPayment, id: newId("p"), deal_id: id });
    return id;
  }
  const s = await sb();
  const r = must(await s.from("deals").insert(d).select("id").single()) as { id: string };
  if (firstPayment) must(await s.from("deal_payments").insert({ ...firstPayment, deal_id: r.id }));
  return r.id;
}
export async function addPayment(p: Omit<Payment, "id">): Promise<void> {
  if (isDemo) {
    db.payments.push({ ...p, id: newId("p") });
    return;
  }
  must(await (await sb()).from("deal_payments").insert(p));
}
export async function markPaid(paymentId: string, paid: boolean) {
  const at = paid ? new Date().toISOString().slice(0, 10) : null;
  if (isDemo) {
    const p = db.payments.find((x) => x.id === paymentId);
    if (p) p.paid_at = at;
    return;
  }
  must(await (await sb()).from("deal_payments").update({ paid_at: at }).eq("id", paymentId));
}

// ---------- inbox ----------
export async function listLeads(): Promise<Lead[]> {
  if (isDemo) return db.leads;
  return must(await (await sb()).from("leads").select("*").is("deleted_at", null).order("created_at", { ascending: false })) as Lead[];
}
export async function updateLead(id: string, patch: Partial<Lead>) {
  if (isDemo) {
    Object.assign(db.leads.find((l) => l.id === id) ?? {}, patch);
    return;
  }
  must(await (await sb()).from("leads").update(patch).eq("id", id));
}
export async function listScrap(): Promise<ScrapRequest[]> {
  if (isDemo) return db.scrap;
  return must(await (await sb()).from("scrap_requests").select("*").is("deleted_at", null).order("created_at", { ascending: false })) as ScrapRequest[];
}
export async function getScrap(id: string) {
  return (await listScrap()).find((s) => s.id === id) ?? null;
}
export async function updateScrap(id: string, patch: Partial<ScrapRequest>) {
  if (isDemo) {
    Object.assign(db.scrap.find((s) => s.id === id) ?? {}, patch);
    return;
  }
  must(await (await sb()).from("scrap_requests").update(patch).eq("id", id));
}

// ---------- vault & finance (ciphertext only: the server can't read any of it) ----------
export async function getVaultRecord(): Promise<VaultRecord | null> {
  if (isDemo) return db.vault as VaultRecord;
  return ((await (await sb()).from("vault").select("*").maybeSingle()).data as VaultRecord | null) ?? null;
}
export async function saveVaultRecord(r: VaultRecord) {
  if (isDemo) {
    db.vault = r as typeof db.vault;
    return;
  }
  must(await (await sb()).from("vault").upsert({ id: 1, ...r }));
}
export async function listEnc(table: "business_expenses" | "other_income"): Promise<EncRow[]> {
  if (isDemo) return db[table];
  return must(await (await sb()).from(table).select("id,month,payload_enc").is("deleted_at", null).order("month")) as EncRow[];
}
export async function addEnc(table: "business_expenses" | "other_income", month: string, payload_enc: string) {
  if (!/^v1\.[A-Za-z0-9+/=]+$/.test(payload_enc)) throw new Error("expected ciphertext");
  if (isDemo) {
    db[table].push({ id: newId("x"), month, payload_enc });
    return;
  }
  must(await (await sb()).from(table).insert({ month, payload_enc }));
}
export async function saveEncPrices(vehicleId: string, purchase?: string, min?: string) {
  for (const t of [purchase, min]) if (t && !/^v1\.[A-Za-z0-9+/=]+$/.test(t)) throw new Error("expected ciphertext");
  return updateVehicle(vehicleId, { ...(purchase ? { purchase_price_enc: purchase } : {}), ...(min ? { min_price_enc: min } : {}) });
}

// ---------- home: what needs attention now (no money on this screen) ----------
export async function attention() {
  const [vehicles, leads, scrap, payments, deals, customers] = await Promise.all([listVehicles(), listLeads(), listScrap(), listPayments(), listDeals(), rawCustomers()]);
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const stock = vehicles.filter((v) => v.status !== "sold");
  return {
    scrapWaiting: scrap.filter((s) => s.status === "new"),
    newLeads: leads.filter((l) => l.status === "new"),
    overdue: payments
      .filter((p) => !p.paid_at && p.due_date < today)
      .map((p) => {
        const d = deals.find((x) => x.id === p.deal_id);
        return { payment: p, deal: d, customer: customers.find((c) => c.id === d?.customer_id) };
      }),
    testsSoon: stock.filter((v) => v.test_valid_until && v.test_valid_until <= in30),
    stuck: stock.filter((v) => Date.now() - Date.parse(v.stock_in_date) > 60 * 86_400_000),
    reservationsExpired: stock.filter((v) => v.status === "reserved" && v.reserved_until && v.reserved_until < today),
    counts: { prep: stock.filter((v) => v.status === "prep").length, available: stock.filter((v) => v.status === "available").length, reserved: stock.filter((v) => v.status === "reserved").length, total: stock.length },
  };
}
