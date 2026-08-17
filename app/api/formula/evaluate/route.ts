import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateFormulaSchema } from "@/lib/formula/schemas";
import { evaluate, formatTrace, FormulaError, parseFormula } from "@/src/core/formula";
import { serverRng } from "@/src/server/services/rng";

/**
 * Bac a sable de formule (V1-D4, ticket : "le bac a sable utilise le meme
 * moteur que le jeu reel, pas un chemin parallele") : appelle exactement
 * `parseFormula`/`evaluate`/`formatTrace`, les memes fonctions que
 * `resolveDamageRoll`/`resolveAttackRoll` (src/core/rules/action.ts, deja
 * cablees aux actions de jeu reelles). `serverRng` (`crypto.randomInt`,
 * jamais `Math.random()`, CLAUDE.md regle 6) — un jet en mode "roll" doit
 * passer par le serveur, pas par un generateur cote client.
 *
 * Aucune ecriture, aucune lecture de ruleset : une erreur de parsing/limite
 * (`FormulaError` et ses sous-classes — syntaxe invalide, arbre trop
 * profond, reference inconnue) est une saisie utilisateur attendue, jamais
 * une panne serveur — 400, pas 500.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = evaluateFormulaSchema.safeParse(body);
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
    const ast = parseFormula(parsed.data.formula);
    const { value, trace } = evaluate(ast, parsed.data.context, serverRng, parsed.data.mode);
    return NextResponse.json({ value, trace, text: formatTrace(trace) }, { status: 200 });
  } catch (error) {
    if (error instanceof FormulaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
