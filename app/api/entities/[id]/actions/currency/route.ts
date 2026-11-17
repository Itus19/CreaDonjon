import { NextResponse, type NextRequest } from "next/server";
import { guardSheetActionRoute } from "@/lib/characterActions/routeGuard";
import { currencyChangeSchema } from "@/lib/characterActions/schemas";
import { changeCurrency } from "@/src/server/services/inventoryActions";
import { readCurrencySystemForEntity } from "@/src/server/services/currencySystem";

const ERROR_RESPONSES = {
  not_found: { message: "Fiche introuvable.", status: 404 },
  forbidden: { message: "Vous n'avez pas le droit de modifier cet inventaire.", status: 403 },
  conflict: { message: "L'inventaire a été modifié entre-temps. Réessayez.", status: 409 },
  insufficient_funds: { message: "Fonds insuffisants, même en cassant des pièces plus grosses.", status: 400 },
  item_not_found: { message: "Cet objet n'est pas dans l'inventaire.", status: 404 },
  unknown_coin: { message: "Cette pièce n'existe pas dans le système monétaire de ce monde.", status: 400 },
} as const;

// Interrupteur « currency » de la table (V3.1-108) : le MJ peut se réserver la monnaie.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardSheetActionRoute(request, params, currencyChangeSchema, "currency");
  if (!guard.ok) return guard.response;
  const { supabase, userId, entityId, body } = guard;

  // V3.1-218 : le système monétaire de la campagne (ou du monde), lu par la chaîne de rulesets.
  const system = await readCurrencySystemForEntity(supabase, { entityId, campaignId: body.campaignId });
  const result = await changeCurrency(supabase, { entityId, delta: body.delta, actorUserId: userId, system });
  if ("error" in result) {
    const { message, status } = ERROR_RESPONSES[result.error];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json(result.block, { status: 200 });
}
