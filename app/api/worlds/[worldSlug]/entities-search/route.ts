import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchEntities } from "@/src/server/services/entities";
import { getWorldBySlug } from "@/src/server/services/worlds";

/**
 * Recherche d'entites par nom, exposee par slug de monde (V1-B5, selecteur
 * d'objets a double source : regles ET entites — specs/fiche-personnage-
 * interactive.md §5.2). Meme fonction que `/api/search`, juste resolue par
 * slug plutot que par worldId pour que le client (qui ne connait le monde
 * que par son slug) n'ait pas a faire un aller-retour supplementaire.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const q = request.nextUrl.searchParams.get("q") ?? "";

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

  const results = await searchEntities(supabase, world.id, q);
  return NextResponse.json(results, { status: 200 });
}
