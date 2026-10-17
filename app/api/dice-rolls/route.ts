import { NextResponse, type NextRequest } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { freeformRollSchema } from "@/lib/diceRolls/schemas";
import { rollFreeformUnrecorded } from "@/src/server/services/checkRolls";

/**
 * Jet libre hors de tout monde (V3.1-35, dés de l'accueil). Le serveur lance,
 * rien n'est enregistré ; `hidden` et `dcPrivate` n'ont pas de sens ici et
 * sont ignorés. Connecté seulement : l'accueil n'existe pas sans compte.
 */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = freeformRollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const result = rollFreeformUnrecorded({
    pool: parsed.data.pool,
    modifier: parsed.data.modifier,
    advantage: parsed.data.advantage,
    label: parsed.data.label,
    dc: parsed.data.dc,
  });
  if (!result.ok) {
    const message = result.reason === "invalid_pool" ? "Choisissez au moins un dé." : "L'avantage demande un seul d20.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(result.roll, { status: 200 });
}
