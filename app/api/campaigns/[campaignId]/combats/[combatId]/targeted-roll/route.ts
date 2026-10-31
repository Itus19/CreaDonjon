import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { guardCombatRoute } from "@/lib/combats/routeGuard";
import { targetedRollSchema } from "@/lib/combats/schemas";
import { resolveTargetedRoll } from "@/src/server/services/targetedRoll";
import { TARGETED_ROLL_MESSAGES as MESSAGES } from "@/lib/combats/targetedRollMessages";
import type { Locale } from "@/src/i18n/request";

type Params = { params: Promise<{ campaignId: string; combatId: string }> };


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
