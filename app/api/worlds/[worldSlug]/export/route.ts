import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportWorld } from "@/src/server/services/worldExport";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldOwnerId } from "@/src/server/repos/worlds";

/** Export d'un monde en JSON (V2-G1, dernier point) — reserve au proprietaire, telechargeable depuis l'ecran d'accueil. */
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
  const ownerId = await getWorldOwnerId(supabase, world.id);
  if (ownerId !== user.id) {
    return NextResponse.json({ error: "Seul le proprietaire du monde peut l'exporter." }, { status: 403 });
  }

  try {
    const result = await exportWorld(supabase, world.id);
    // Renvoie {data, warnings} plutot qu'un telechargement direct : le
    // client doit pouvoir afficher les avertissements (ex. ruleset
    // personnel omis) AVANT de declencher l'enregistrement du fichier.
    return NextResponse.json({ ...result, suggestedFilename: `${world.slug}.creadonjon.json` }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Echec de l'export." }, { status: 400 });
  }
}
