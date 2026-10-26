import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCreatureCombat } from "@/src/server/services/creatureCombat";

const zParams = z.object({ id: z.string().uuid() });

/**
 * V3.1-79 — les instances de cette créature dans l'initiative en cours
 * (`creatureCombat.ts`), pour le MJ seulement. `{ combat: null }` hors combat
 * ou pour un joueur : la fiche se montre alors en modèle, sans commande.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = zParams.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const combat = await getCreatureCombat(supabase, { entityId: parsed.data.id, userId: user.id });
  return NextResponse.json({ combat }, { status: 200 });
}
