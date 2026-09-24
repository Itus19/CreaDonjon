import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { getOpenAiCompatibleProviderFromEnv } from "@/src/server/ai/adapters/openAiCompatible";
import { narrateSoloTurn, reconstructTurnForNarration } from "@/src/server/ai/soloNarration";
import { AiRateLimitError } from "@/src/server/ai/callAi";

const bodySchema = z.object({
  entityId: z.string().uuid(),
  campaignId: z.string().uuid(),
  worldSlug: z.string().min(1),
});

/**
 * V3-B4 — « Raconter autrement » : une narration DE PLUS pour un tour déjà
 * journalisé, jamais un nouveau jet. `eventId` (dans l'URL) est le
 * `roll`/`player_action` d'origine — le même que celui que la première
 * narration portait déjà dans son `payload.from_event`.
 *
 * Aucun écran n'appelle encore cette route (le fil, V3-D4, n'existe pas) :
 * elle est prête pour lui, comme `buildSoloTurnContext` l'était pour
 * `narrateSoloTurn`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, parsed.data.worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const sessionId = await getOrOpenSessionForCampaign(supabase, parsed.data.campaignId);
  const reconstructed = await reconstructTurnForNarration(supabase, sessionId, eventId);
  if (!reconstructed.ok) {
    return NextResponse.json({ error: reconstructed.reason }, { status: 404 });
  }

  let provider;
  try {
    provider = getOpenAiCompatibleProviderFromEnv();
  } catch {
    return NextResponse.json({ error: "Aucun fournisseur IA local configuré." }, { status: 503 });
  }

  const viewer = await buildViewerForWorld(supabase, world.id, user.id);
  try {
    const outcome = await narrateSoloTurn(supabase, provider, {
      worldId: world.id,
      campaignId: parsed.data.campaignId,
      playerEntityId: parsed.data.entityId,
      viewer,
      userId: user.id,
      sessionId,
      fromEventId: eventId,
      playerAction: reconstructed.playerAction,
      facts: reconstructed.facts,
      changes: reconstructed.changes,
      hints: reconstructed.hints,
    });
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.invalidReason ?? "La narration n'a pas abouti." }, { status: 502 });
    }
    return NextResponse.json({ text: outcome.narration, npcReaction: outcome.npcReaction ?? null }, { status: 200 });
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return NextResponse.json({ error: "Trop d'appels, réessaie dans quelques minutes." }, { status: 429 });
    }
    throw error;
  }
}
