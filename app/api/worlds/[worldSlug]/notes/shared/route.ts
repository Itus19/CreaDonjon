import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notebookRouteParamsSchema } from "@/lib/notebook/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listSharedNotes } from "@/src/server/services/sharedNotes";

/**
 * V3.1-41 (ADR 0037) — « Partagées à la table » : les pages partagées que
 * l'appelant peut lire. La RLS des blocs fait le tri ; un nom de fiche non
 * découverte arrive sans identifiant.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const route = notebookRouteParamsSchema.safeParse(await params);
  if (!route.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const world = await getWorldBySlug(supabase, route.data.worldSlug);
  if (!world) return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });

  return NextResponse.json({ notes: await listSharedNotes(supabase, { worldId: world.id, userId: user.id }) }, { status: 200 });
}
