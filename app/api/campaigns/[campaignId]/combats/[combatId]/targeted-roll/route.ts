import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { targetedRollSchema } from "@/lib/combats/schemas";
import { resolveTargetedRoll, type TargetedRollErrorReason } from "@/src/server/services/targetedRoll";
import type { Locale } from "@/src/i18n/request";

type Params = { params: Promise<{ campaignId: string; combatId: string }> };

const MESSAGES: Record<TargetedRollErrorReason, { status: number; error: string }> = {
  not_running: { status: 409, error: "Aucun combat en cours." },
  target_not_found: { status: 404, error: "Cible introuvable dans ce combat." },
  actor_not_found: { status: 404, error: "Acteur introuvable." },
  invalid_action: { status: 400, error: "Cette action ne va pas avec ce jet." },
  no_attack: { status: 400, error: "Cette action n'a pas de bonus d'attaque." },
  no_save_data: { status: 400, error: "Ce sort ne déclare pas de sauvegarde." },
  no_formula: { status: 400, error: "Cette action n'a pas de formule de dés." },
  no_slot_available: { status: 409, error: "Plus d'emplacement de ce niveau." },
  not_a_weapon: { status: 400, error: "Cet objet n'est pas une arme." },
  item_not_found: { status: 404, error: "Objet ou sort introuvable sur la fiche." },
  not_a_spellcaster: { status: 400, error: "Ce personnage ne lance pas de sorts." },
  not_found: { status: 404, error: "Fiche introuvable." },
  invalid_target: { status: 422, error: "Cet effet ne peut pas viser cette cible." },
};

/**
 * V3.1-105 (ADR 0042) — « Cibler » : un jet résolu par le moteur contre un
 * participant du combat en cours, puis appliqué et journalisé. MJ seulement
 * (garde des routes de combat) : un joueur attend les changements signés
 * (ADR 0041, V3.1-104).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const guard = await guardCombatRoute(params);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = targetedRollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const result = await resolveTargetedRoll(guard.supabase, {
    campaignId: guard.params.campaignId,
    combatId: guard.params.combatId!,
    callerId: guard.userId,
    locale: (await getLocale()) as Locale,
    input: parsed.data,
  });
  if (!result.ok) {
    const { status, error } = MESSAGES[result.reason];
    return NextResponse.json({ error, ...(result.detail ? { detail: result.detail } : {}) }, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
