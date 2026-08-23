import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rollDice } from "@/src/core/dice/roll";
import { serverRng } from "@/src/server/services/rng";
import { ROLL_DICE_COUNT, ROLL_DICE_FACES, ROLL_KEEP_HIGHEST } from "@/src/core/rules/abilityGeneration";

/**
 * Tirage des six caracteristiques (methode "roll" de l'assistant de creation
 * de personnage, specs/wiki-liens-et-personnages.md §B8 etape 3) : 4d6, on
 * garde les 3 meilleurs, six fois. Route dediee plutot qu'un calcul cote
 * client — CLAUDE.md regle 6, "les des sont lances par le serveur", vaut
 * aussi hors combat.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const rolls = Array.from({ length: 6 }, () =>
    rollDice(ROLL_DICE_COUNT, ROLL_DICE_FACES, serverRng, { mode: "kh", count: ROLL_KEEP_HIGHEST }).total
  );

  return NextResponse.json({ rolls }, { status: 200 });
}
