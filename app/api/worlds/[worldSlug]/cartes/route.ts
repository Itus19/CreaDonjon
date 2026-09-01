import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCarteOptions } from "@/src/server/services/mapSource";

/** Liste des fiches `carte` du monde, pour le selecteur "referencer une carte existante" (Lot I, phase F₁) — voir `listCarteOptions`. */
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

  const options = await listCarteOptions(supabase, world.id);
  return NextResponse.json(options, { status: 200 });
}
