import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityTree } from "@/src/server/services/entities";

/**
 * Arborescence de la barre laterale seule (retour utilisateur : dupliquer/
 * supprimer une fiche ou reordonner les categories "mettait un temps
 * vraiment long" — meme cause que RelationsChips.tsx, `router.refresh()`
 * relancait toute la page). `getEntityTree` (4 requetes en parallele,
 * bornees au monde) plutot que `getEntityWindowData` (~6, y compris blocs/
 * portrait/campagnes de la fiche COURANTE, sans rapport avec la barre
 * laterale elle-meme).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const tree = await getEntityTree(supabase, world.id, user.id);
  return NextResponse.json(tree, { status: 200 });
}
