import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { activateFeatureSchema } from "@/lib/characterActions/schemas";
import { activateFeature, type ActivateFeatureFailure } from "@/src/server/services/featureActivation";
import { getCampaign } from "@/src/server/services/campaigns";
import { isWorldAdmin } from "@/src/server/services/permissions";
import type { Locale } from "@/src/i18n/request";

/**
 * V3.1-130 (ADR 0060 §5) — « utiliser » une règle du personnage. Entrée Zod,
 * droit d'agir sur la fiche (garde commune, `canEditEntity`), puis le service :
 * le noyau vérifie et lance les dés côté serveur. Le MJ écrit directement ; un
 * joueur écrit par changement signé ce qui n'est pas à lui (ADR 0041, 0073).
 */
const MESSAGES: Record<ActivateFeatureFailure, string> = {
  not_found: "Fiche de personnage ou campagne introuvable.",
  feature_not_owned: "Ce personnage n'a pas cette règle.",
  no_activation_block: "Cette règle ne se joue pas (aucune activation déclarée).",
  unknown_activation: "Activation inconnue pour cette règle.",
  unknown_variant: "Variante inconnue pour cette activation.",
  requires_not_met: "Les conditions de cette activation ne sont pas remplies.",
  not_enough_resource: "Ressource insuffisante.",
  slot_too_low: "Il faut un emplacement d'au moins le niveau du sort.",
  no_target: "Choisissez au moins une cible.",
  too_many_targets: "Trop de cibles pour cette activation.",
  unknown_target: "Cible inconnue.",
  unknown_effect: "La règle pose un effet qu'elle ne décrit pas.",
  invalid_formula: "Une formule de cette règle n'a pas pu se calculer.",
  no_combat: "Aucun combat en cours pour viser ces cibles.",
  target_not_found: "Cette cible n'est pas dans le combat en cours.",
  spell_not_known: "Ce personnage ne connaît pas ce sort.",
  no_slot_available: "Plus d'emplacement de ce niveau.",
  unknown_cast_option: "Cette option de lancement n'existe pas pour ce personnage.",
  token_required: "Cette utilisation n'existe que tant que l'effet qui l'accorde dure.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, activateFeatureSchema);
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  const campaign = await getCampaign(supabase, body.campaignId);
  if (!campaign) return NextResponse.json({ error: MESSAGES.not_found }, { status: 404 });
  const callerIsGm = await isWorldAdmin(supabase, { worldId: campaign.worldId, userId });

  const locale = (await getLocale()) as Locale;
  const result = await activateFeature(supabase, {
    entityId,
    campaignId: body.campaignId,
    ruleKey: body.ruleKey,
    activationId: body.activationId,
    variantId: body.variantId,
    targetParticipantIds: body.targetParticipantIds,
    callerId: userId,
    callerIsGm,
    locale,
    ...(body.spell ? { spell: body.spell } : {}),
  });
  if (!result.ok) {
    const message = MESSAGES[result.reason];
    return NextResponse.json({ error: message, reason: result.reason, ...(result.detail ? { detail: result.detail } : {}) }, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
