import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { getOpenAiCompatibleProviderFromEnv } from "@/src/server/ai/adapters/openAiCompatible";
import { askSoloGm } from "@/src/server/ai/soloGmQuestion";
import { AiRateLimitError } from "@/src/server/ai/callAi";

const bodySchema = z.object({
  entityId: z.string().uuid(),
  campaignId: z.string().uuid(),
  worldSlug: z.string().min(1),
  question: z.string().min(1).max(500),
});

/**
 * V3-D4 — Le bouton « MJ » : pose une question hors du temps de jeu.
 *
 * Ne fait PAS partie du même best-effort que la narration
 * (`app/api/solo/tour/route.ts`) : ici, poser la question EST l'action
 * entière — un échec doit remonter au joueur, jamais rester silencieux.
 * Même style d'erreur que `.../tour/[eventId]/autrement/route.ts`.
 */
export async function POST(request: NextRequest) {
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

  let provider;
  try {
    provider = getOpenAiCompatibleProviderFromEnv();
  } catch {
    return NextResponse.json({ error: "Aucun fournisseur IA local configuré." }, { status: 503 });
  }

  const [viewer, sessionId] = await Promise.all([
    buildViewerForWorld(supabase, world.id, user.id),
    getOrOpenSessionForCampaign(supabase, parsed.data.campaignId),
  ]);

  try {
    const outcome = await askSoloGm(supabase, provider, {
      worldId: world.id,
      campaignId: parsed.data.campaignId,
      playerEntityId: parsed.data.entityId,
      viewer,
      userId: user.id,
      sessionId,
      question: parsed.data.question,
    });
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.invalidReason ?? "La question n'a pas abouti." }, { status: 502 });
    }
    return NextResponse.json({ answer: outcome.answer, eventId: outcome.eventId }, { status: 200 });
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return NextResponse.json({ error: "Trop d'appels, réessaie dans quelques minutes." }, { status: 429 });
    }
    throw error;
  }
}
