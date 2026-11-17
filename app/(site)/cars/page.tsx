import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalog } from "@/lib/data/public";
import { Catalog } from "@/components/site/Catalog";

export const metadata: Metadata = { title: "רכבים במלאי", description: "כל הרכבים במגרש: סינון לפי יצרן, מחיר, שנה, ק״מ ויד." };
export const revalidate = 60;

export default async function CarsPage() {
  const cars = await getCatalog();
  return (
    <div className="wrap">
      <Suspense><Catalog cars={cars} /></Suspense>
    </div>
  );
}
