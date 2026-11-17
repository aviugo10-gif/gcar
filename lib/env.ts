// Demo mode: no Supabase keys yet (the accounts aren't open). The app runs on seeded in-memory data so every screen
// can be seen and tested. Production refuses to start in demo mode.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const BUSINESS_PHONE = process.env.NEXT_PUBLIC_BUSINESS_PHONE ?? "0528528282";
export const PHOTO_BASE = SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/vehicle-photos/` : "/demo/";

if (isDemo && process.env.VERCEL_ENV === "production") {
  throw new Error("Supabase env vars are missing in production");
}
