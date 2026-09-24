import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { playEncashedTurn } from "@/src/server/services/turnLoop";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { getOpenAiCompatibleProviderFromEnv } from "@/src/server/ai/adapters/openAiCompatible";
import { narrateSoloTurn } from "@/src/server/ai/soloNarration";
import type { Locale } from "@/src/i18n/request";
import type { EncashedTurnOutcome } from "@/lib/solo/types";

const bodySchema = z.object({
  entityId: z.string().uuid(),
  campaignId: z.string().uuid(),
  worldSlug: z.string().min(1),
  natural: z.number().int().min(1).max(20),
  origin: z.enum(["volet", "a_la_main"]),
});

/**
 * V3-B5 — Le pendant de `POST /api/solo/tour` pour une demande deja posee :
 * `natural` est un nombre NU (1 a 20), jamais un total — le modificateur qui
 * s'y ajoute vient de la demande, figee a sa pose (`pending_request`),
 * jamais recalcule ici depuis la fiche.
 *
 * Memes raisons d'erreur que `executeIntent`/`resolveIntentRequest`
 * (turnIntent.ts) ; `no_pending_request` et `out_of_range` sont propres a
 * l'encaissement.
 */
const REASON_STATUS = {
  not_found: 404,
  forbidden: 403,
  item_not_found: 404,
  not_a_weapon: 400,
  not_a_spellcaster: 400,
  no_pending_request: 409,
  out_of_range: 400,
} as const;
const REASON_MESSAGE = {
  not_found: "Fiche de personnage introuvable ou sans ruleset résolvable.",
  forbidden: "Vous n'avez pas le droit de jouer cette fiche.",
  item_not_found: "Cet objet n'est plus dans l'inventaire.",
  not_a_weapon: "Cet objet n'est pas une arme.",
  not_a_spellcaster: "Cette fiche ne lance pas de sorts.",
  no_pending_request: "Aucun jet n'est demandé en ce moment.",
  out_of_range: "Un dé annoncé se lit entre 1 et 20.",
} as const;

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

  const locale = (await getLocale()) as Locale;
  const outcome = await playEncashedTurn(supabase, {
    entityId: parsed.data.entityId,
    campaignId: parsed.data.campaignId,
    callerId: user.id,
    locale,
    natural: parsed.data.natural,
    origin: parsed.data.origin,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: REASON_MESSAGE[outcome.error] }, { status: REASON_STATUS[outcome.error] });
  }

  const result: EncashedTurnOutcome = outcome;

  // La phrase d'origine du joueur (« j'attaque le gobelin ») n'a pas
  // retraverse cette requete : `resolveIntentRequest` la reprend de la
  // demande posee (`pending_request.player_action_text`) et la range dans
  // `intent.text`, exactement comme `executeIntent` le fait pour un tour
  // immediat — c'est ce que la narration attend en `playerAction`.
  const intentText = (result.record.detail.intent as { text?: string } | undefined)?.text ?? "";

  // La narration : TOUJOURS apres, TOUJOURS best-effort — meme raison et
  // meme forme qu'en `POST /api/solo/tour` (specs/cible-locale-et-ia.md
  // §4 : aucune fonction essentielle ne depend du succes d'un appel).
  if (result.record.eventId) {
    try {
      const provider = getOpenAiCompatibleProviderFromEnv();
      const [viewer, sessionId] = await Promise.all([
        buildViewerForWorld(supabase, world.id, user.id),
        getOrOpenSessionForCampaign(supabase, parsed.data.campaignId),
      ]);
      const narrated = await narrateSoloTurn(supabase, provider, {
        worldId: world.id,
        campaignId: parsed.data.campaignId,
        playerEntityId: parsed.data.entityId,
        viewer,
        userId: user.id,
        sessionId,
        fromEventId: result.record.eventId,
        playerAction: intentText,
        facts: result.record.facts,
        changes: result.changes,
        hints: result.hints,
      });
      if (narrated.ok) {
        result.narration = { text: narrated.narration!, npcReaction: narrated.npcReaction ?? null };
      }
    } catch {
      // Aucun fournisseur configure, ou l'appel a echoue : le tour reste
      // valide sans narration, jamais une erreur renvoyee au joueur pour ca.
    }
  }

  return NextResponse.json(result, { status: 200 });
}
