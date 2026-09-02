import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRelationSchema } from "@/lib/relations/schemas";
import { addRelation, listVisibleRelations } from "@/src/server/services/relations";
import { getEntityById } from "@/src/server/repos/entities";

/**
 * Relations d'une fiche seules (retour utilisateur : ajouter un lien
 * "mettait un temps vraiment long a s'afficher") — `RelationsChips.tsx`
 * appelait `router.refresh()` apres chaque ajout/suppression, qui
 * relance TOUTE la page (`getEntityWindowData` : blocs, relations,
 * fiches du monde, categories, campagnes, mise en page du portrait) pour
 * mettre a jour une simple liste de puces. Meme motif que
 * `relationsReloadSignal` deja utilise par les blocs genealogie/reseau
 * (`EntityBlocks.tsx`) : un rechargement cible, jamais la page entiere.
 */
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
    return NextResponse.json([], { status: 200 });
  }

  const relations = await listVisibleRelations(supabase, entity.world_id, entityId, user.id);
  return NextResponse.json(relations, { status: 200 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: entityId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createRelationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Corps invalide." },
      { status: 400 }
    );
  }

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

  const result = await addRelation(supabase, {
    worldId: entity.world_id,
    sourceEntityId: entityId,
    targetEntityId: parsed.data.targetEntityId,
    relationType: parsed.data.relationType,
    visibilityLevel: parsed.data.visibility.level,
    visibilityScopeId: parsed.data.visibility.scopeId,
    createdBy: user.id,
  });
  if (!result.ok) {
    const message =
      result.reason === "duplicate" ? "Cette relation existe déjà." : "Cette relation créerait un cycle de parenté.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
