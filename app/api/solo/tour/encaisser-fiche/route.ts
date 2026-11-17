import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { playEncashedTurnFromRoll } from "@/src/server/services/turnLoop";
import { narrerTourSoloSansFaillir } from "@/src/server/ai/soloNarration";
import type { Locale } from "@/src/i18n/request";
import type { EncashedTurnOutcome, FenetreReactionResponse } from "@/lib/solo/types";

const bodySchema = z.object({
  entityId: z.string().uuid(),
  campaignId: z.string().uuid(),
  worldSlug: z.string().min(1),
});

/**
 * V3-B5 Phase 2 — Le troisième pendant de `POST /api/solo/tour` pour une
 * demande déjà posée : « un bouton de sa fiche, le modificateur est connu,
 * il s'ajoute au clic ». Contrairement à `.../encaisser`, aucun nombre ne
 * vient du client — un clic de fiche ne demande rien au joueur, c'est le
 * serveur qui tire le dé (`resolveIntentRequestFromRoll`, turnIntent.ts),
 * avec les mêmes fonctions que les anciens boutons d'action.
 *
 * Mêmes raisons d'erreur que `.../encaisser` — `resolveIntentRequestFromRoll`
 * ne rend jamais `out_of_range` (aucun nombre ne vient du client sur ce
 * chemin), mais la garde `ResolveIntentErrorReason` reste le meme type
 * fermé que l'autre route : la couvrir ici coûte une ligne, l'omettre
 * romprait le typage sans rien gagner.
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
  const outcome = await playEncashedTurnFromRoll(supabase, {
    entityId: parsed.data.entityId,
    campaignId: parsed.data.campaignId,
    callerId: user.id,
    locale,
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: REASON_MESSAGE[outcome.error] }, { status: REASON_STATUS[outcome.error] });
  }
  // V3.1-216 : une réaction peut intervenir — le tour n'est pas joué, la
  // demande reste posée, et c'est le bandeau de réaction qui prend la suite.
  if ("window" in outcome) {
    const attente: FenetreReactionResponse = { fenetre: outcome.window };
    return NextResponse.json(attente, { status: 200 });
  }

  const result: EncashedTurnOutcome = outcome;
  const intentText = (result.record.detail.intent as { text?: string } | undefined)?.text ?? "";

  // La narration : TOUJOURS apres, TOUJOURS best-effort — meme raison et
  // meme forme que les deux autres routes du tour solo.
  if (result.record.eventId) {
    const narre = await narrerTourSoloSansFaillir(supabase, {
      worldId: world.id,
      campaignId: parsed.data.campaignId,
      playerEntityId: parsed.data.entityId,
      userId: user.id,
      fromEventId: result.record.eventId,
      playerAction: intentText,
      facts: result.record.facts,
      changes: result.changes,
      hints: result.hints,
    });
    if (narre) result.narration = { text: narre.text, npcReaction: narre.npcReaction };
  }

  return NextResponse.json(result, { status: 200 });
}
