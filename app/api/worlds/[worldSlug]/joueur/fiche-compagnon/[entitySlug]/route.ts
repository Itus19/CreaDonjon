import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityBySlug } from "@/src/server/repos/entities";
import { canUserEditEntity } from "@/src/server/services/permissions";
import { getEntityWindowData } from "@/src/server/services/entityWindow";
import { getPlayerEntityDetail } from "@/src/server/services/playerEntityDetail";

/**
 * Donnee d'une fiche ouverte en "compagnon" depuis le cahier de notes cote
 * joueur (V2.1-2, piste "un seul compagnon" — pas de fenetre flottante ici,
 * la coquille joueur n'en a pas, voir `NotebookWorkspace.tsx`). Reprend
 * EXACTEMENT le meme branchement que `joueur/wiki/[entitySlug]/page.tsx` :
 * une fiche editable par ce joueur (son PJ, une fiche de lore accordee)
 * s'ouvre en edition, toute autre fiche visible s'ouvre en lecture seule —
 * jamais l'inverse, jamais un fallback plus permissif.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ worldSlug: string; entitySlug: string }> }
) {
  const { worldSlug, entitySlug } = await params;
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

  const entity = await getEntityBySlug(supabase, world.id, entitySlug);
  if (!entity) {
    return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  }

  const canEdit = await canUserEditEntity(supabase, { worldId: world.id, entityId: entity.id, userId: user.id });
  if (canEdit) {
    const data = await getEntityWindowData(supabase, worldSlug, entitySlug);
    if (!data) return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
    return NextResponse.json({ mode: "edit", ...data }, { status: 200 });
  }

  const detail = await getPlayerEntityDetail(supabase, { worldId: world.id, entitySlug, userId: user.id });
  if (!detail) {
    return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
  }
  return NextResponse.json({ mode: "read", worldSlug, ...detail }, { status: 200 });
}
