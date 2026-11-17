import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemo, SITE_URL } from "@/lib/env";
import { db, newId } from "@/lib/demo";
import { supabaseService } from "@/lib/supabase/server";
import { clientKey, memLimit, sameOrigin } from "@/lib/server/guard";
import { isValidPhone, normalizePhone } from "@/lib/il";
import { notifyOwner } from "@/lib/notify";

const Body = z.object({
  kind: z.enum(["vehicle", "general", "notify_me"]),
  slug: z.string().max(120).optional(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().refine(isValidPhone),
  message: z.string().max(1000).optional(),
  privacy: z.literal(true),
  marketing: z.boolean().optional(),
  website: z.string().max(0).optional(), // honeypot: real people leave it empty
  t: z.number().optional(), // ms the form was open; bots submit instantly
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "origin" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const b = parsed.data;
  if (b.t !== undefined && b.t < 2500) return NextResponse.json({ ok: true }); // silently drop bots
  const key = await clientKey();
  if (!memLimit("lead:" + key, 5, 600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });

  let carTitle: string | undefined;
  if (isDemo) {
    const v = b.slug ? db.vehicles.find((x) => x.listing?.slug === b.slug) : undefined;
    carTitle = v ? `${v.make} ${v.model} ${v.year}` : undefined;
    db.leads.unshift({ id: newId("l"), kind: b.kind, vehicle_id: v?.id, name: b.name, phone: normalizePhone(b.phone), message: b.message, status: "new", created_at: new Date().toISOString() });
  } else {
    const { error } = await supabaseService().rpc("submit_lead", {
      p_kind: b.kind, p_vehicle_slug: b.slug ?? null, p_name: b.name, p_phone: b.phone, p_message: b.message ?? null,
      p_privacy: true, p_marketing: b.marketing ?? false, p_client_key: key,
    });
    if (error) return NextResponse.json({ error: error.message.includes("rate") ? "rate" : "save" }, { status: error.message.includes("rate") ? 429 : 500 });
    carTitle = b.slug?.replace(/-/g, " ");
  }
  const title = b.kind === "notify_me" ? "בקשה: תגידו לי כשמגיע" : carTitle ? `פנייה על ${carTitle}` : "פנייה חדשה מהאתר";
  await notifyOwner({ title, lines: [b.name, b.message ? b.message.slice(0, 140) : ""].filter(Boolean), link: `${SITE_URL}/admin/inbox` }).catch(() => null);
  return NextResponse.json({ ok: true });
}
