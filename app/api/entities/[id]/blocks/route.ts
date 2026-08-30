import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBlockSchema } from "@/lib/blocks/schemas";
import { createBlock, listVisibleBlocks } from "@/src/server/services/blocks";
import { getEntityById } from "@/src/server/repos/entities";

/** Blocs d'une entite, filtres par visibilite (V1-E4 suite : fiche de personnage complete dans le derouleur "Caracteristiques" de l'ecran Initiative) — meme fonction que la fenetre secondaire (`getEntityWindowData`), sans passer par le slug puisque l'appelant a deja l'id. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const entity = await getEntityById(supabase, entityId);
  if (!entity) {
    return NextResponse.json({ error: "Entite introuvable." }, { status: 404 });
  }

  const blocks = await listVisibleBlocks(supabase, entity.world_id, entityId, user.id);
  return NextResponse.json(blocks, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Corps invalide." },
      { status: 400 }
    );
  }
  if (parsed.data.entityId !== entityId) {
    return NextResponse.json({ error: "entityId incoherent avec l'URL." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await createBlock(supabase, {
    entityId,
    blockType: parsed.data.blockType,
    label: parsed.data.label,
    visibilityLevel: parsed.data.visibility.level,
    visibilityScopeId: parsed.data.visibility.scopeId,
    createdBy: user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Vous n'avez pas le droit d'ajouter un bloc a cette fiche." }, { status: 403 });
  }

  return NextResponse.json(result.block, { status: 201 });
}
