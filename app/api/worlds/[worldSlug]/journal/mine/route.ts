import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getMergedJournalForWorld, getPlayerJournalForWorld } from "@/src/server/services/activityJournal";

/**
 * Journal pour l'ecran d'accueil (retour utilisateur, colonne de droite) —
 * un seul point d'entree qui s'adapte au role plutot que deux routes : le
 * MJ (proprietaire/editeur/MJ de campagne) recoit le journal complet du
 * monde, un joueur recoit la version restreinte a ses fiches PJ
 * (`getPlayerJournalForWorld`), et un non-membre est refuse. Distinct de
 * `/api/worlds/[worldSlug]/journal` (V2-M7, espace MJ) : celui-ci reste
 * strictement reserve au MJ, jamais adapte au role.
 */
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

  const viewer = await buildViewerForWorld(supabase, world.id, user.id);
  if (viewer.kind === "anonymous") {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }
  const isAdmin = viewer.worldRole === "owner" || viewer.worldRole === "editor" || Object.values(viewer.campaignRoles).includes("gm");
  const isMember = isAdmin || viewer.worldRole !== null || Object.keys(viewer.campaignRoles).length > 0;
  if (!isMember) {
    return NextResponse.json({ error: "Vous n'etes pas membre de ce monde." }, { status: 403 });
  }

  const entries = isAdmin ? await getMergedJournalForWorld(supabase, world.id) : await getPlayerJournalForWorld(supabase, world.id);
  return NextResponse.json({ entries }, { status: 200 });
}
