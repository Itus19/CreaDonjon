import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listGeneratorTablesSchema } from "@/lib/blocks/schemas";
import { listGeneratorSectionTables } from "@/src/server/services/generators";
import { serverRng } from "@/src/server/services/rng";

/**
 * Liste les blocs `random_table` tires par une section de generateur pour
 * la variante donnee (V2-J9bis, specs/outils-mj.md §3) — alimente le
 * bouton "Éditer les tables" du panneau MJ Generateurs, jamais un tirage :
 * aucune consommation d'`unique_draws`, juste une lecture. Meme discipline
 * RLS que tout le reste (`listBlocksForEntity` sous-jacent), un MJ non
 * authentifie ne voit rien.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = listGeneratorTablesSchema.safeParse(body ?? {});
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

  const tables = await listGeneratorSectionTables(supabase, blockId, serverRng, parsed.data.variant);
  if (!tables) {
    return NextResponse.json({ error: "Generateur introuvable." }, { status: 404 });
  }

  return NextResponse.json({ tables }, { status: 200 });
}
