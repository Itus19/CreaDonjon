import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notebookRouteParamsSchema, shareNotebookPageSchema } from "@/lib/notebook/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { unshareNotebookPage } from "@/src/server/services/sharedNotes";

const ERREURS = {
  not_found: { message: "Page introuvable dans votre cahier.", status: 404 },
  forbidden: { message: "Vous ne pouvez plus modifier cette page.", status: 403 },
  conflict: { message: "Le cahier a changé entre-temps. Réessayez.", status: 409 },
} as const;

/** V3.1-41 (ADR 0037) — « Ne plus partager » : la page de SON cahier redevient privée ; son texte reste intact. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const route = notebookRouteParamsSchema.safeParse(await params);
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

  const result = await unshareNotebookPage(supabase, { worldId: world.id, userId: user.id, itemId: body.data.itemId });
  if (!result.ok) return NextResponse.json({ error: ERREURS[result.reason].message }, { status: ERREURS[result.reason].status });
  return new NextResponse(null, { status: 204 });
}
