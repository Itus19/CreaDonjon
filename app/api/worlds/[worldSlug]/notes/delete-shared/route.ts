import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { shareNotebookPageSchema } from "@/lib/notebook/schemas";
import { worldRouteParamsSchema } from "@/lib/worlds/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { deleteSharedNotebookPage } from "@/src/server/services/sharedNotes";

const ERREURS = {
  not_found: { message: "Page introuvable dans votre cahier.", status: 404 },
  forbidden: { message: "Vous ne pouvez plus supprimer cette page.", status: 403 },
  conflict: { message: "Le cahier a changé entre-temps. Réessayez.", status: 409 },
} as const;

/**
 * V3.1-144 — supprimer une page partagée depuis son cahier. « Ne plus
 * partager » (`../unshare`) la rend privée et garde son texte ; ici elle
 * disparaît, pour son autrice comme pour la table.
 *
 * Même entrée que le partage (`itemId`, l'élément du cahier de l'appelant) :
 * le serveur retrouve lui-même l'entité `shared_note` visée, le client n'en
 * nomme jamais une.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const route = worldRouteParamsSchema.safeParse(await params);
  if (!route.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const body = shareNotebookPageSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const world = await getWorldBySlug(supabase, route.data.worldSlug);
  if (!world) return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });

  const result = await deleteSharedNotebookPage(supabase, { worldId: world.id, userId: user.id, itemId: body.data.itemId });
  if (!result.ok) return NextResponse.json({ error: ERREURS[result.reason].message }, { status: ERREURS[result.reason].status });
  return new NextResponse(null, { status: 204 });
}
