import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { undoLastSoloTurn } from "@/src/server/services/turnUndo";

const zParams = z.object({ campaignId: z.string().uuid() });

const ERREURS: Record<string, { status: number; error: string }> = {
  not_found: { status: 404, error: "Partie introuvable." },
  not_solo: { status: 409, error: "Seule une partie solo s'annule tour par tour." },
  forbidden: { status: 403, error: "Seule la joueuse de cette partie peut annuler un tour." },
  nothing_to_undo: { status: 409, error: "Aucun tour à annuler." },
};

/**
 * V3-F2 — « Annuler ce tour » (partie solo). Aucun corps : le serveur trouve
 * lui-même le dernier tour dans le journal et vérifie que l'appelante est la
 * joueuse (le MJ de sa campagne solo). Le journal reste en ajout seul.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const adresse = zParams.safeParse(await params);
  if (!adresse.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const r = await undoLastSoloTurn(supabase, { campaignId: adresse.data.campaignId, callerId: user.id });
    if (!r.ok) {
      const e = ERREURS[r.reason]!;
      return NextResponse.json({ error: e.error }, { status: e.status });
    }
    return NextResponse.json(r, { status: 200 });
  } catch (erreur) {
    // Une écriture refusée en cours de route : jamais muet.
    console.error("Annulation d'un tour en échec", erreur);
    return NextResponse.json({ error: "Le tour n'a pas pu être annulé entièrement. Rechargez la partie." }, { status: 500 });
  }
}
