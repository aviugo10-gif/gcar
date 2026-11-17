import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isDemo } from "@/lib/env";
import { supabaseService } from "@/lib/supabase/server";
import { clientKey, memLimit, sameOrigin } from "@/lib/server/guard";

// Signed one-time upload URL into the private scrap-photos bucket. The browser compresses to JPEG ≤ 1600px first.
export async function POST() {
  if (!(await sameOrigin())) return NextResponse.json({ error: "origin" }, { status: 403 });
  if (!memLimit("scrap-up:" + (await clientKey()), 12, 600_000)) return NextResponse.json({ error: "rate" }, { status: 429 });
  if (isDemo) return NextResponse.json({ demo: true });
  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.jpg`;
  const { data, error } = await supabaseService().storage.from("scrap-photos").createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: "storage" }, { status: 500 });
  return NextResponse.json({ path, url: data.signedUrl });
}
