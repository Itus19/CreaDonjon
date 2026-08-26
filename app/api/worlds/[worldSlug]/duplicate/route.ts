import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { duplicateWorld } from "@/src/server/services/worldExport";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldOwnerId } from "@/src/server/repos/worlds";

/** Duplication en un clic (V2-G1, dernier point) : export + import pour le meme proprietaire, sans passer par un fichier. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
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
  const ownerId = await getWorldOwnerId(supabase, world.id);
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "Seul le proprietaire du monde peut le dupliquer." }, { status: 403 });
  }

  try {
    const result = await duplicateWorld(supabase, { worldId: world.id, ownerId: user.id });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Echec de la duplication." }, { status: 400 });
  }
}
