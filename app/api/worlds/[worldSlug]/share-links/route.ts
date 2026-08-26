import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listShareLinks } from "@/src/server/services/shareLinks";
import { getWorldBySlug } from "@/src/server/services/worlds";

/**
 * Liens de partage d'un monde, exposes par slug (V1-C4) : le panneau de
 * partage a quitte l'accueil du monde pour un onglet du menu de reglages
 * (specs/arbitrage-modifications.md §3.1) — ce dernier est rendu globalement
 * (app/layout.tsx, hors contexte serveur d'un monde precis), donc il ne peut
 * plus recevoir `worldId`/`links` en props depuis la page ; il les recupere
 * ici cote client des qu'il detecte un slug de monde dans l'URL.
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

  const links = await listShareLinks(supabase, world.id);
  return NextResponse.json(
    { worldId: world.id, links, wikiWelcomeMessage: world.wiki_welcome_message },
    { status: 200 },
  );
}
