import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getOrCreatePlayerNotes } from "@/src/server/services/playerNotes";

/**
 * Fiche de notes privee de l'appelant, pour ce monde (V2-M7b, coquille
 * joueur) — cree au premier passage si absente. Reserve a un compte
 * authentifie (n'importe lequel : MJ comme joueur peuvent avoir leurs
 * propres notes), jamais partage entre comptes.
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

  const notes = await getOrCreatePlayerNotes(supabase, { worldId: world.id, userId: user.id });
  return NextResponse.json(notes, { status: 200 });
}
