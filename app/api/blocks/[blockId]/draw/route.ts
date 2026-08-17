import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { drawTableSchema } from "@/lib/blocks/schemas";
import { drawFromTableBlock } from "@/src/server/services/tables";
import { serverRng } from "@/src/server/services/rng";
import { TableError } from "@/src/core/tables/errors";

/**
 * Tirage sur un bloc `random_table` (V1-E1, specs/outils-mj.md §2) —
 * `serverRng` (`crypto.randomInt`, jamais `Math.random()` cote client,
 * CLAUDE.md regle 6), meme discipline que les jets de des et le bac a
 * sable de formule (V1-D4). Un cycle ou une cascade trop profonde
 * (`TableError`) est une table mal construite par son auteur, une saisie a
 * corriger — 400, pas 500.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ blockId: string }> }) {
  const { blockId } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = drawTableSchema.safeParse(body);
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

  try {
    const draws = await drawFromTableBlock(supabase, blockId, serverRng, parsed.data.count);
    if (!draws) {
      return NextResponse.json({ error: "Table introuvable." }, { status: 404 });
    }
    return NextResponse.json({ draws }, { status: 200 });
  } catch (error) {
    if (error instanceof TableError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
