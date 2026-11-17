import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rollWindowActionSchema } from "@/lib/rollWindows/schemas";
import { getRollWindow } from "@/src/server/repos/rollWindows";
import { answerRollWindow, continueRollWindow, resumeRollWindow } from "@/src/server/services/rollWindowResume";
import { getCampaignById } from "@/src/server/repos/campaigns";
import { narrerTourSoloSansFaillir } from "@/src/server/ai/soloNarration";
import type { ResumedRoll } from "@/src/server/services/rollWindowResume";
import type { Locale } from "@/src/i18n/request";

const zParams = z.object({ campaignId: z.string().uuid(), windowId: z.string().uuid() });

/**
 * V3.1-160 (ADR 0075) — répondre à une fenêtre de réaction, « Continuer »
 * (le MJ), ou la reprendre (l'auteur du jet). Les barrières sont en base :
 * `answer_roll_window` (sa propre ligne, une fois), `close_roll_window` (tout
 * le monde a répondu, ou le MJ), `engine_resume_roll_window` (l'auteur, une
 * fois, demande signée).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ campaignId: string; windowId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = rollWindowActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { campaignId, windowId } = parsedParams.data;
  const row = await getRollWindow(supabase, windowId);
  if (!row || row.campaign_id !== campaignId) return NextResponse.json({ error: "Fenêtre introuvable." }, { status: 404 });
  const locale = (await getLocale()) as Locale;
  const action = parsed.data;

  if (action.action === "resume") {
    if (row.author_user_id !== user.id || row.status !== "closed" || row.resumed_at !== null) {
      return NextResponse.json({ error: "Cette fenêtre ne se reprend pas (pas ton jet, encore ouverte, ou déjà reprise)." }, { status: 409 });
    }
    const resumed = await resumeRollWindow(supabase, { windowId, campaignId, callerId: user.id, locale });
    await narrerSiTourSolo(supabase, { campaignId, userId: user.id, resumed });
    return NextResponse.json({ ok: true, closed: true, resumed }, { status: 200 });
  }
  const result =
    action.action === "answer"
      ? await answerRollWindow(supabase, { windowId, index: action.index, use: action.use, callerId: user.id, locale })
      : await continueRollWindow(supabase, { windowId, callerId: user.id, locale });
  if (result.ok && result.resumed) await narrerSiTourSolo(supabase, { campaignId, userId: user.id, resumed: result.resumed });
  if (!result.ok) return NextResponse.json({ error: result.reason === "not_found" ? "Fenêtre introuvable." : "Cette réponse ne t'appartient pas, ou la fenêtre est fermée." }, { status: result.reason === "not_found" ? 404 : 403 });
  return NextResponse.json(result, { status: 200 });
}

/**
 * V3.1-216 — un tour solo repris ici est un tour comme un autre : la
 * narration vient APRÈS, best-effort, et ne dit que ce que le moteur a
 * tranché (règle absolue 8). Elle vit dans la route, jamais dans la boucle
 * de tour (`turnIntent.noAi.test.ts` le verrouille).
 */
async function narrerSiTourSolo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { campaignId: string; userId: string; resumed: ResumedRoll },
): Promise<void> {
  if (params.resumed.origin !== "solo_turn") return;
  const tour = params.resumed.result;
  if ("error" in tour || "window" in tour || !tour.record.eventId) return;
  const campaign = await getCampaignById(supabase, params.campaignId);
  if (!campaign) return;
  const narre = await narrerTourSoloSansFaillir(supabase, {
    worldId: campaign.world_id,
    campaignId: params.campaignId,
    playerEntityId: params.resumed.entityId,
    userId: params.userId,
    fromEventId: tour.record.eventId,
    playerAction: (tour.record.detail.intent as { text?: string } | undefined)?.text ?? "",
    facts: tour.record.facts,
    changes: tour.changes,
    hints: tour.hints,
  });
  if (narre) tour.narration = { text: narre.text, npcReaction: narre.npcReaction };
}
