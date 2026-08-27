import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createEntityWithNameSchema } from "@/lib/entities/schemas";
import { createEntity } from "@/src/server/services/entities";

/**
 * Creation a la volee (V2-H3, bloc genealogie) : contrairement a
 * `createBlankEntityAction` (server action, redirige toujours vers la
 * nouvelle fiche), cette route JSON cree une entite et la renvoie sans
 * quitter la page — necessaire pour "creer la carte «X»" directement
 * depuis l'arbre, sans perdre le contexte du bloc en cours d'edition.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createEntityWithNameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const entity = await createEntity(supabase, {
    worldId: parsed.data.worldId,
    createdBy: user.id,
    name: parsed.data.name,
    entityKind: parsed.data.entityKind,
    aliases: [],
  });

  return NextResponse.json(entity, { status: 201 });
}
