import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkCombatAccess } from "@/src/server/services/combats";

/**
 * V3.1-101 (ADR 0040) — la porte commune de toutes les routes
 * `/api/campaigns/[campaignId]/combats/**` : parametres d'adresse valides
 * (Zod, regle absolue 4), appelant connecte, et MJ de la campagne. Une route
 * n'ecrit sa logique qu'apres `ok: true` ; sinon elle renvoie `response`.
 */
const zCombatRouteParams = z.object({
  campaignId: z.string().uuid(),
  combatId: z.string().uuid().optional(),
  participantId: z.string().uuid().optional(),
});
export type CombatRouteParams = z.infer<typeof zCombatRouteParams>;

type Guarded =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string; params: CombatRouteParams }
  | { ok: false; response: NextResponse };

export async function guardCombatRoute(rawParams: Promise<Record<string, string>>): Promise<Guarded> {
  const parsed = zCombatRouteParams.safeParse(await rawParams);
  if (!parsed.success) {
    return { ok: false, response: NextResponse.json({ error: "Adresse invalide." }, { status: 400 }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  }

  const access = await checkCombatAccess(supabase, { userId: user.id, ...parsed.data });
  if (access === "forbidden") {
    return { ok: false, response: NextResponse.json({ error: "Réservé au MJ de la campagne." }, { status: 403 }) };
  }
  if (access === "not_found") {
    return { ok: false, response: NextResponse.json({ error: "Combat introuvable." }, { status: 404 }) };
  }
  return { ok: true, supabase, userId: user.id, params: parsed.data };
}
