import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Hashed client key for rate limiting (no raw IPs stored). */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return createHash("sha256").update(ip + (process.env.ID_NUMBER_HMAC_KEY ?? "gcar")).digest("hex").slice(0, 24);
}

// In-memory limiter used in demo mode and as a first line before the database limiter.
const hits = new Map<string, number[]>();
export function memLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length <= max;
}

/** Same-origin check for public POSTs (forms are posted by our own pages only). */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!origin) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}
