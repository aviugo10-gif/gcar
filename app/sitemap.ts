export const revalidate = 3600;
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { getCatalog } from "@/lib/data/public";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cars = await getCatalog();
  return [
    ...["", "/cars", "/sell-scrap", "/contact", "/privacy", "/terms", "/accessibility"].map((p) => ({ url: SITE_URL + p })),
    ...cars.map((c) => ({ url: `${SITE_URL}/cars/${c.slug}`, lastModified: c.published_at ?? undefined })),
  ];
}
