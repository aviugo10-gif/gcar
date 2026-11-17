import { createHmac, timingSafeEqual } from "node:crypto";
// Demo mode only: a signed cookie stands in for the Supabase session (password + second factor).
const SECRET = process.env.DEMO_SECRET ?? "gcar-demo-secret-not-for-production";
export const DEMO_COOKIE = "gc_demo";
export const sign = (v: string) => `${v}.${createHmac("sha256", SECRET).update(v).digest("hex").slice(0, 32)}`;
export function verify(cookie?: string): boolean {
  if (!cookie) return false;
  const [v] = cookie.split(".");
  const a = Buffer.from(sign(v)), b = Buffer.from(cookie);
  return a.length === b.length && timingSafeEqual(a, b) && Number(v) > Date.now();
}
