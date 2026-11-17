import { NextResponse } from "next/server";
import { isDemo } from "@/lib/env";
import { lookupPlate, demoLookup } from "@/lib/gov";
import { clientKey, memLimit } from "@/lib/server/guard";

// Public: used by the scrap form ("is this your car?") and the admin add-car flow. Returns only make/model/year level data.
export async function GET(req: Request) {
  const plate = new URL(req.url).searchParams.get("plate")?.replace(/\D/g, "") ?? "";
  if (plate.length < 5 || plate.length > 8) return NextResponse.json({ error: "plate" }, { status: 400 });
  if (!memLimit("plate:" + (await clientKey()), 20, 600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  const v = (await lookupPlate(plate)) ?? (isDemo ? demoLookup(plate) : null);
  if (!v) return NextResponse.json({ found: false });
  const { raw: _raw, vin: _vin, ...pub } = v;
  return NextResponse.json({ found: true, vehicle: pub });
}
