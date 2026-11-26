import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { hasEventFromEvent } from "@/src/server/repos/sessions";
import { narrerTourSoloSansFaillir, reconstructTurnForNarration } from "@/src/server/ai/soloNarration";
import type { NarrationTourResponse } from "@/lib/solo/types";

const paramsSchema = z.object({ eventId: z.string().uuid() });
const bodySchema = z.object({
  entityId: z.string().uuid(),
  campaignId: z.string().uuid(),
  worldSlug: z.string().min(1),
});

/**
 * V3.2-20 — La PREMIÈRE narration d'un jet déjà encaissé, demandée à part.
 *
 * Avant, `.../encaisser-fiche` tirait le dé PUIS attendait le modèle avant de
 * répondre : avec un modèle local, le dé défilait une quinzaine de secondes
 * à l'écran alors que le serveur le connaissait déjà. Désormais l'écran
 * encaisse avec `narrer: false`, affiche le dé tout de suite, puis appelle
 * cette route pour le récit.
 *
 * Rien n'est relancé ni recalculé : les faits sont relus dans le journal
 * (`reconstructTurnForNarration`, comme « raconter autrement »). La
 * narration reste best-effort (`narrerTourSoloSansFaillir`) : un échec
 * laisse le tour joué, et la raison remonte à l'écran.
 *
 * Une seule fois par jet : si une narration porte déjà ce `from_event`
 * (double clic, onglet rechargé), la route refuse (409) au lieu d'en écrire
 * une seconde. « Raconter autrement » reste le chemin pour une autre version.
 *
 * Coût (docs/QUOTAS.md) : une invocation de plus par jet, et trois lectures
 * légères (session, jet, application de règles) en plus de la narration
 * elle-même, déjà comptée avant ce ticket.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  }
  const eventId = parsedParams.data.eventId;
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

  // La RLS de `session_events` borne déjà ces lectures aux membres du monde.
  const sessionId = await getOrOpenSessionForCampaign(supabase, parsed.data.campaignId);
  if (await hasEventFromEvent(supabase, sessionId, "narration", eventId)) {
    return NextResponse.json({ error: "Ce tour est déjà raconté." }, { status: 409 });
  }
  const tour = await reconstructTurnForNarration(supabase, sessionId, eventId);
  if (!tour.ok) {
    return NextResponse.json({ error: tour.reason }, { status: 404 });
  }

  const narre = await narrerTourSoloSansFaillir(supabase, {
    worldId: world.id,
    campaignId: parsed.data.campaignId,
    playerEntityId: parsed.data.entityId,
    userId: user.id,
    fromEventId: eventId,
    playerAction: tour.playerAction,
    facts: tour.facts,
    changes: tour.changes,
    hints: tour.hints,
  });

  const reponse: NarrationTourResponse = narre.ok
    ? { narration: { text: narre.text, npcReaction: narre.npcReaction }, time: narre.time, ...(narre.scene ? { scene: narre.scene } : {}) }
    : { narration: null, time: null, sansNarration: narre.raison, sansNarrationDetail: narre.detail };
  return NextResponse.json(reponse, { status: 200 });
}
