import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rollDice } from "@/src/core/dice/roll";
import { serverRng } from "@/src/server/services/rng";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { readWorldCharacterRules } from "@/src/server/services/resolvedRuleset";

const bodySchema = z.object({
  /** Le monde dont le ruleset dit COMMENT tirer (V3.1-115, ADR 0046). */
  worldSlug: z.string().trim().min(1).max(200),
});

/**
 * Tirage des caracteristiques (methode "roll" de l'assistant de creation de
 * personnage, specs/wiki-liens-et-personnages.md §B8 etape 3). Le nombre et
 * la taille des des, ceux qu'on garde et le nombre de tirages viennent des
 * regles de personnage du ruleset du monde (`character_rules.ability_generation.roll`,
 * V3.1-115) : plus aucune constante ici. Route dediee plutot qu'un calcul
 * cote client — CLAUDE.md regle 8, "les des sont lances par le serveur", vaut
 * aussi hors combat.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps invalide." }, { status: 400 });
  }

  const world = await getWorldBySlug(supabase, parsed.data.worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const rules = await readWorldCharacterRules(supabase, world.id);
  if (!rules) {
    return NextResponse.json({ error: "Ce ruleset n'a pas de règles de personnage." }, { status: 400 });
  }
  const roll = rules.ability_generation.roll;
  if (!roll) {
    return NextResponse.json({ error: "Ce ruleset ne propose pas la méthode de tirage." }, { status: 400 });
  }

  const rolls = Array.from({ length: roll.rolls }, () =>
    rollDice(roll.dice_count, roll.dice_faces, serverRng, { mode: "kh", count: roll.keep_highest }).total
  );

  return NextResponse.json({ rolls }, { status: 200 });
}
