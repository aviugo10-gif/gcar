import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemo, SITE_URL } from "@/lib/env";
import { db, newId } from "@/lib/demo";
import { supabaseService } from "@/lib/supabase/server";
import { clientKey, memLimit, sameOrigin, readJson } from "@/lib/server/guard";
import { isValidPhone, normalizePhone } from "@/lib/il";
import { notifyOwner } from "@/lib/notify";
import { getHolidays, getSettings } from "@/lib/data/public";
import { scrapPromise } from "@/lib/promise";

const Body = z.object({
  plate: z.string().regex(/^\d{5,8}$/).optional(),
  make: z.string().max(40).optional(), model: z.string().max(60).optional(),
  year: z.number().int().min(1950).max(2100).optional(), km: z.number().int().min(0).max(2_000_000).optional(),
  answers: z.record(z.string().max(30), z.string().max(30)).default({}),
  photos: z.array(z.string().max(200)).max(8).default([]),
  city: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(80),
  phone: z.string().refine(isValidPhone),
  contact_pref: z.enum(["call", "whatsapp"]),
  privacy: z.literal(true),
  website: z.string().max(0).optional(),
  t: z.number().optional(),
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "origin" }, { status: 403 });
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "invalid", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const b = parsed.data;
  if (b.t !== undefined && b.t < 5000) return NextResponse.json({ ok: true });
  const key = await clientKey();
  if (!memLimit("scrap:" + key, 3, 600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });

  const [s, holidays] = await Promise.all([getSettings(), getHolidays()]);
  const promise = scrapPromise(new Date(), s.hours, holidays, s.scrap.promise_enabled, s.scrap.promise_minutes);
  const promisedBy = promise.kind === "minutes" ? new Date(Date.now() + s.scrap.promise_minutes * 60_000).toISOString() : null;

  if (isDemo) {
    db.scrap.unshift({ id: newId("s"), ...b, phone: normalizePhone(b.phone), status: "new", promised_by: promisedBy, created_at: new Date().toISOString() });
  } else {
    const { error } = await supabaseService().rpc("submit_scrap_request", { p: { ...b, promised_by: promisedBy }, p_client_key: key });
    if (error) return NextResponse.json({ error: "save" }, { status: error.message.includes("rate") ? 429 : 500 });
  }
  await notifyOwner({
    title: `פנייה לפירוק: ${[b.make, b.model, b.year].filter(Boolean).join(" ") || "רכב"}`,
    lines: [`${b.city} · ${b.name}`, promisedBy ? `הובטחה הצעה עד ${new Date(promisedBy).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" })}` : promise.text],
    link: `${SITE_URL}/admin/inbox?tab=scrap`,
  }).catch(() => null);
  return NextResponse.json({ ok: true, promise });
}
