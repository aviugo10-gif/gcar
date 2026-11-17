import "server-only";
// Israeli vehicle registry (data.gov.il, Ministry of Transport open data). One plate fills make, model, year, colour,
// fuel, last test and ownership type, so the owner only types what the registry can't know.
// Not reachable from the build sandbox: field names follow the published dataset schema and are re-checked on first deploy.
const RESOURCES = [
  "053cea08-09bc-40ec-8f7a-156f0677aff3", // private & commercial vehicles
];
export type GovVehicle = {
  plate: string; make: string; model: string; trim: string | null; year: number | null; color: string | null;
  fuel: string | null; test_valid_until: string | null; last_test: string | null; ownership: string | null; vin: string | null; raw: Record<string, unknown>;
};
const FUEL: Record<string, string> = { בנזין: "petrol", דיזל: "diesel", "חשמל/בנזין": "hybrid", "חשמל/דיזל": "hybrid", חשמל: "electric", "גפ\"מ": "gas" };
export const GOV_OWNERSHIP: Record<string, string> = { השכרה: "rental", ליסינג: "leasing", חברה: "company", מונית: "taxi", "לימוד נהיגה": "driving_school", ממשלתי: "government" };
const clean = (s: unknown) => (typeof s === "string" ? s.trim() : null);

export async function lookupPlate(plate: string): Promise<GovVehicle | null> {
  const n = plate.replace(/\D/g, "");
  if (n.length < 5 || n.length > 8) return null;
  for (const id of RESOURCES) {
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${id}&filters=${encodeURIComponent(JSON.stringify({ mispar_rechev: Number(n) }))}&limit=1`;
    try {
      const r = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) continue;
      const j = (await r.json()) as { result?: { records?: Record<string, unknown>[] } };
      const rec = j.result?.records?.[0];
      if (!rec) continue;
      return {
        plate: n,
        make: clean(rec.tozeret_nm)?.split(" ")[0] ?? "",
        model: clean(rec.kinuy_mishari) ?? clean(rec.degem_nm) ?? "",
        trim: clean(rec.ramat_gimur),
        year: Number(rec.shnat_yitzur) || null,
        color: clean(rec.tzeva_rechev),
        fuel: FUEL[clean(rec.sug_delek_nm) ?? ""] ?? null,
        test_valid_until: clean(rec.tokef_dt)?.slice(0, 10) ?? null,
        last_test: clean(rec.mivchan_acharon_dt)?.slice(0, 10) ?? null,
        ownership: clean(rec.baalut),
        vin: clean(rec.misgeret),
        raw: rec,
      };
    } catch {
      /* registry down: the form simply asks for the fields */
    }
  }
  return null;
}

/** Demo stand-in so the add-car flow can be tried without the registry. */
export function demoLookup(plate: string): GovVehicle | null {
  const n = plate.replace(/\D/g, "");
  if (n.length < 7) return null;
  return { plate: n, make: "סוזוקי", model: "סוויפט", trim: "GLX", year: 2020, color: "כסף", fuel: "petrol", test_valid_until: "2027-03-14", last_test: "2026-03-10", ownership: "פרטי", vin: null, raw: { demo: true } };
}
