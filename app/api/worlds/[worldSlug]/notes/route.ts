import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getOrCreateNotebook } from "@/src/server/services/notebook";

/**
 * Cahier de notes privé de l'appelant, pour ce monde (V2.1-2, remplace
 * l'ancien textarea V2-M7b) — créé au premier passage si absent. Réservé à
 * un compte authentifié (n'importe lequel : MJ comme joueuse ont leur
 * propre cahier), jamais partagé entre comptes.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const notebook = await getOrCreateNotebook(supabase, { worldId: world.id, userId: user.id });
  return NextResponse.json(notebook, { status: 200 });
}
