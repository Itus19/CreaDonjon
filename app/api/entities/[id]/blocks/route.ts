import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createBlockSchema, saveEntityBlocksSchema } from "@/lib/blocks/schemas";
import { createBlock, listVisibleBlocks, saveEntityBlocks } from "@/src/server/services/blocks";
import { getEntityById } from "@/src/server/repos/entities";

/** Blocs d'une entite, filtres par visibilite (V1-E4 suite : fiche de personnage complete dans le derouleur "Caracteristiques" de l'ecran Initiative) — meme fonction que la fenetre secondaire (`getEntityWindowData`), sans passer par le slug puisque l'appelant a deja l'id. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const entity = await getEntityById(supabase, entityId);
  if (!entity) {
    return NextResponse.json({ error: "Entité introuvable." }, { status: 404 });
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
    return NextResponse.json({ error: "entityId incohérent avec l'URL." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
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
    if (result.reason === "duplicate_block_type") {
      return NextResponse.json({ error: "Cette fiche a déjà un bloc de ce type." }, { status: 409 });
    }
    return NextResponse.json({ error: "Vous n'avez pas le droit d'ajouter un bloc à cette fiche." }, { status: 403 });
  }

  return NextResponse.json(result.block, { status: 201 });
}

/**
 * V3.1-31 — « Enregistrer » de l'editeur plein ecran : plusieurs blocs de la
 * fiche (contenu, visibilite, ordre) en UNE ecriture, tout ou rien. 409 si une
 * version est perimee : rien n'a ete ecrit.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entityId = z.guid().safeParse(id);
  if (!entityId.success) {
    return NextResponse.json({ error: "Identifiant d'entité invalide." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = saveEntityBlocksSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let result;
  try {
    result = await saveEntityBlocks(supabase, {
      entityId: entityId.data,
      changedBy: user.id,
      changes: parsed.data.changes.map((c) => ({
        id: c.id,
        version: c.version,
        display: c.display,
        data: c.data,
        visibilityLevel: c.visibility.level,
        visibilityScopeId: c.visibility.scopeId,
        displayOrder: c.displayOrder,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Données de bloc invalides." }, { status: 400 });
    }
    throw error;
  }

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Bloc introuvable dans cette fiche." }, { status: 404 });
    }
    if (result.reason === "forbidden") {
      return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette fiche." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Un bloc a été modifié entre-temps : rien n'a été enregistré. Rechargez avant de réessayer." },
      { status: 409 }
    );
  }
  return NextResponse.json({ blocks: result.blocks }, { status: 200 });
}
