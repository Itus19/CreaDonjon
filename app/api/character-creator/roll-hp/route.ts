import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rollDice } from "@/src/core/dice/roll";
import { serverRng } from "@/src/server/services/rng";

const bodySchema = z.object({
  dieFaces: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
});

/**
 * Jet de de de vie pour un niveau au-dela du premier, a la CREATION d'un
 * personnage qui demarre directement a un niveau superieur (V2-G1, retour
 * utilisateur — meme besoin qu'a la montee de niveau, mais l'assistant de
 * creation n'a pas d'action serveur unique a l'arrivee : il ecrit le bloc
 * `character` tel quel, comme `abilities.method: "roll"` le fait deja).
 * Route dediee plutot qu'un calcul cote client, meme motif exact que
 * `/api/character-creator/roll-abilities` — CLAUDE.md regle 6, "les des
 * sont lances par le serveur", vaut hors combat aussi.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const roll = rollDice(1, parsed.data.dieFaces, serverRng).total;
  return NextResponse.json({ roll }, { status: 200 });
}
