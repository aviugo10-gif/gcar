import "server-only";
import { cache } from "react";
import { isDemo } from "../env";
import { db } from "../demo";
import { supabasePublic } from "../supabase/server";
import type { PublicCar, Settings, Vehicle } from "../types";

function toPublic(v: Vehicle): PublicCar | null {
  const l = v.listing;
  if (!l || !l.is_published || !["available", "reserved"].includes(v.status)) return null;
  const show = (f: string) => l.visible_fields.includes(f);
  const tags = [...l.tags];
  if (v.hand === 1 && !tags.includes("first_hand")) tags.push("first_hand");
  if (l.published_at && Date.now() - Date.parse(l.published_at) < 14 * 86_400_000 && !tags.includes("new")) tags.unshift("new");
  return {
    slug: l.slug, vehicle_id: v.id, title: l.title_override ?? `${v.make} ${v.model}`, make: v.make, model: v.model, trim: v.trim,
    year: show("year") ? v.year : null, km: show("km") ? v.km : null, hand: show("hand") ? v.hand : null,
    gearbox: show("gearbox") ? v.gearbox ?? null : null, engine_cc: show("engine_cc") ? v.engine_cc ?? null : null,
    fuel: show("fuel") ? v.fuel ?? null : null, test_valid_until: show("test_valid_until") ? v.test_valid_until ?? null : null,
    color: show("color") ? v.color ?? null : null, is_reserved: v.status === "reserved",
    price: l.site_price ?? v.listed_price, sale_price: l.sale_price ?? null, tags, marketing_text: l.marketing_text ?? null,
    pinned: l.pinned, sort: l.sort, published_at: l.published_at ?? null, ownership_flags: v.ownership_flags, equipment: v.equipment,
    photos: v.photos.filter((p) => p.show_on_site).sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.sort - b.sort).map((p) => ({ path: p.path, w: p.w, h: p.h })),
  };
}

export const getCatalog = cache(async (): Promise<PublicCar[]> => {
  let rows: PublicCar[];
  if (isDemo) rows = db.vehicles.map(toPublic).filter((x): x is PublicCar => !!x);
  else {
    const { data, error } = await supabasePublic().from("public_catalog").select("*");
    if (error) throw error;
    rows = data as PublicCar[];
  }
  // recommended order: pinned first, then the owner's sort, then newest
  return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sort - b.sort || Date.parse(b.published_at ?? "0") - Date.parse(a.published_at ?? "0"));
});

export async function getCar(slug: string): Promise<PublicCar | null> {
  return (await getCatalog()).find((c) => c.slug === slug) ?? null;
}

/** For a sold or removed car: keep old links alive with "sold" + similar cars. */
export async function getSoldStub(slug: string): Promise<{ title: string; make: string } | null> {
  if (isDemo) {
    const v = db.vehicles.find((x) => x.listing?.slug === slug);
    return v ? { title: `${v.make} ${v.model}`, make: v.make } : null;
  }
  return null; // production: the slug lookup goes through a small security-definer function (stage 4)
}

export const getSettings = cache(async (): Promise<Settings> => {
  if (isDemo) return db.settings;
  const { data, error } = await supabasePublic().from("public_settings").select("key,value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])) as Settings;
});

export const getHolidays = cache(async (): Promise<string[]> => {
  if (isDemo) return db.holidays;
  const { data } = await supabasePublic().from("public_holidays").select("date");
  return (data ?? []).map((r: { date: string }) => r.date);
});

export { filterCatalog, type CatalogQuery } from "../catalog";
