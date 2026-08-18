import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { getEncounterBudgetTable } from "@/src/server/services/encounters";

/**
 * Table de budget de PX du ruleset par defaut du monde (V1-E3,
 * specs/outils-mj.md §4.1) — `rows: null` si le ruleset n'a pas cette
 * table (cas normal pour le SRD 5.1, voir services/encounters.ts), a
 * distinguer d'une erreur : l'editeur de bloc `encounter` doit alors
 * afficher "budget non disponible pour ce ruleset", pas planter.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const rulesetId = await getWorldDefaultRulesetId(supabase, world.id);
  if (!rulesetId) {
    return NextResponse.json({ rows: null }, { status: 200 });
  }

  const rows = await getEncounterBudgetTable(supabase, rulesetId);
  return NextResponse.json({ rows }, { status: 200 });
}
