import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zCampaignTableSettings } from "@/src/core/campaigns/tableSettings";
import { readTableSettings, writeTableSettings } from "@/src/server/services/tableSettings";

/**
 * V3.1-108 (ADR 0043) — reglages de table d'une campagne : « ce que les
 * joueurs modifient eux-memes ». Lecture par tout membre (les ecrans cachent
 * les commandes coupees), ecriture par le MJ seul. La regle elle-meme vit
 * dans la garde des actions de fiche (`lib/characterActions/routeGuard.ts`).
 */
const zParams = z.object({ campaignId: z.string().uuid() });

async function session(rawParams: Promise<{ campaignId: string }>) {
  const parsed = zParams.safeParse(await rawParams);
  if (!parsed.success) return { ok: false as const, response: NextResponse.json({ error: "Adresse invalide." }, { status: 400 }) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  return { ok: true as const, supabase, userId: user.id, campaignId: parsed.data.campaignId };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const s = await session(params);
  if (!s.ok) return s.response;
  const settings = await readTableSettings(s.supabase, s.campaignId);
  if (settings === "not_found") return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  return NextResponse.json(settings, { status: 200 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const s = await session(params);
  if (!s.ok) return s.response;
  const body: unknown = await request.json().catch(() => null);
  const parsed = zCampaignTableSettings.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }
  const result = await writeTableSettings(s.supabase, { userId: s.userId, campaignId: s.campaignId, patch: parsed.data });
  if (result === "forbidden") return NextResponse.json({ error: "Réservé au MJ de la campagne." }, { status: 403 });
  if (result === "not_found") return NextResponse.json({ error: "Campagne introuvable." }, { status: 404 });
  return NextResponse.json(result, { status: 200 });
}
