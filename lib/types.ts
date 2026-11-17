export type VehicleStatus = "prep" | "available" | "reserved" | "sold";

export type Vehicle = {
  id: string;
  plate: string;
  vin?: string | null;
  make: string;
  model: string;
  trim?: string | null;
  year: number | null;
  color?: string | null;
  fuel?: string | null;
  gearbox?: string | null;
  engine_cc?: number | null;
  km: number | null;
  hand: number | null;
  test_valid_until?: string | null;
  accident: "none" | "minor" | "structural" | "other";
  accident_notes?: string | null;
  notes?: string | null;
  status: VehicleStatus;
  reserved_for?: string | null;
  reserved_until?: string | null;
  stock_in_date: string;
  listed_price: number | null; // agorot
  purchase_price_enc?: string | null;
  min_price_enc?: string | null;
  ownership_flags: string[];
  equipment: string[];
  photos: Photo[];
  listing?: Listing | null;
};

export type Photo = { id: string; path: string; sort: number; is_main: boolean; show_on_site: boolean; w?: number; h?: number };

export type Listing = {
  vehicle_id: string;
  is_published: boolean;
  slug: string;
  title_override?: string | null;
  marketing_text?: string | null;
  site_price?: number | null;
  sale_price?: number | null;
  tags: string[];
  visible_fields: string[];
  pinned: boolean;
  sort: number;
  published_at?: string | null;
};

/** What the public site sees (the public_catalog view). */
export type PublicCar = {
  slug: string;
  vehicle_id: string;
  title: string;
  make: string;
  model: string;
  trim?: string | null;
  year: number | null;
  km: number | null;
  hand: number | null;
  gearbox: string | null;
  engine_cc: number | null;
  fuel: string | null;
  test_valid_until: string | null;
  color: string | null;
  is_reserved: boolean;
  price: number | null;
  sale_price: number | null;
  tags: string[];
  marketing_text: string | null;
  pinned: boolean;
  sort: number;
  published_at: string | null;
  ownership_flags: string[];
  equipment: string[];
  photos: { path: string; w?: number; h?: number }[];
};

export type ExpenseCategory = { id: string; name: string; icon: string; sort: number };
export type VehicleExpense = { id: string; vehicle_id: string; category_id: string; amount: number; date: string; supplier?: string | null; note?: string | null };

export type Customer = {
  id: string;
  full_name: string;
  phone: string;
  phone_alt?: string | null;
  id_number_last4?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
};

export type Deal = {
  id: string;
  vehicle_id: string;
  customer_id: string;
  sale_price: number;
  deal_date: string;
  trade_in_value?: number | null;
  status: "open" | "closed" | "cancelled";
  notes?: string | null;
};
export type Payment = {
  id: string;
  deal_id: string;
  kind: "deposit" | "payment";
  amount: number;
  method: string;
  due_date: string;
  paid_at: string | null;
  check_number?: string | null;
  note?: string | null;
};
export type DealDoc = { id: string; deal_id: string; type: "receipt" | "car_book" | "inspection" | "ownership_transfer" | "agreement" | "disclosure" | "other"; path: string; signed_at?: string | null };
export type DealBalance = { deal_id: string; sale_price: number; paid: number; outstanding: number; overdue_count: number; next_due: string | null };

export type Lead = {
  id: string;
  kind: "vehicle" | "general" | "notify_me";
  vehicle_id?: string | null;
  name: string;
  phone: string;
  message?: string | null;
  status: "new" | "in_progress" | "meeting" | "won" | "lost";
  follow_up_at?: string | null;
  notes?: string | null;
  created_at: string;
};
export type ScrapRequest = {
  id: string;
  plate?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  km?: number | null;
  answers: Record<string, string>;
  photos: string[];
  city?: string | null;
  name: string;
  phone: string;
  contact_pref: "call" | "whatsapp";
  promised_by?: string | null;
  status: "new" | "quoted" | "accepted" | "collected" | "closed" | "rejected";
  quote_amount?: number | null;
  quoted_at?: string | null;
  quote_valid_until?: string | null;
  notes?: string | null;
  created_at: string;
};

/** Finance rows: only `month` is plaintext; the payload is vault-encrypted. */
export type EncRow = { id: string; month: string; payload_enc: string };
export type BusinessExpensePayload = { category: string; amount: number; vat?: number; note?: string };
export type IncomePayload = { category: string; amount: number; note?: string };

export type Settings = {
  business: { name: string; tagline: string; phone: string; whatsapp: string; email: string | null; address: string | null; lat: number | null; lng: number | null; vat_rate: number };
  hours: import("./promise").Hours;
  home: { headline: string; sub: string };
  scrap: { promise_enabled: boolean; promise_minutes: number };
  legal: { accessibility_coordinator: { name: string | null; phone: string | null; email: string | null }; last_audit: string | null };
  contact: { waze: string | null; maps: string | null };
};
