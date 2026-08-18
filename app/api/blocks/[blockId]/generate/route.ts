import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { drawFromGeneratorBlock } from "@/src/server/services/generators";
import { serverRng } from "@/src/server/services/rng";

/**
 * Tirage sur un bloc `generator` (V1-E2, specs/outils-mj.md §3) —
 * `serverRng` (jamais `Math.random()` cote client, CLAUDE.md regle 6), meme
 * discipline que `/api/blocks/[blockId]/draw` (V1-E1). Pas de corps de
 * requete : un generateur produit un seul resultat structure a la fois,
 * pas de parametre `count` comme pour une table.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const result = await drawFromGeneratorBlock(supabase, blockId, serverRng);
  if (!result) {
    return NextResponse.json({ error: "Generateur introuvable." }, { status: 404 });
  }
  return NextResponse.json(result, { status: 200 });
}
