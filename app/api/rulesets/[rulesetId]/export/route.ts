import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportRulesetEntries } from "@/src/server/services/rules";

/**
 * Export "notre format" d'un ruleset (V2-J4, specs/arbitrage-modifications.md
 * §1.2) — miroir exact de `POST /api/rulesets/import` : la meme forme
 * `{name, baseSystem, entries}` que ce que cette route accepte en entree.
 * N'exporte que le contenu PROPRE du ruleset (jamais le SRD dont il herite,
 * cf. `exportRulesetEntries`) — la RLS de lecture normale s'applique, aucun
 * contournement ici.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ rulesetId: string }> }) {
  const { rulesetId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const exported = await exportRulesetEntries(supabase, rulesetId);
  if (!exported) {
    return NextResponse.json({ error: "Ruleset introuvable." }, { status: 404 });
  }

  return NextResponse.json(exported, { status: 200 });
}
