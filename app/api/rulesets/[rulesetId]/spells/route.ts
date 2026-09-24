import { NextResponse, type NextRequest } from "next/server";
import { createHomebrewSpellSchema } from "@/lib/ruleset/schemas";
import { createClient } from "@/lib/supabase/server";
import { createHomebrewSpell } from "@/src/server/services/rules";

/**
 * Creation d'un sort maison (V2-N2) dans la variante `rulesetId` —
 * meme dossier et meme forme que `import/route.ts` : l'identifiant vient de
 * l'URL, le corps est valide par Zod, et c'est la RPC
 * `upsert_ruleset_override` qui refuse d'ecrire dans une base officielle ou
 * dans la variante de quelqu'un d'autre.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ rulesetId: string }> }) {
  const { rulesetId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = createHomebrewSpellSchema.safeParse(body && typeof body === "object" ? { ...body, rulesetId } : null);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { rulesetId: targetRulesetId, ...spell } = parsed.data;
  const result = await createHomebrewSpell(supabase, { rulesetId: targetRulesetId, spell });
  if (!result.ok) {
    const error = result.reason === "unknown_class" ? "Une des classes cochées n'existe pas dans la variante active." : (result.message ?? "Sort invalide.");
    return NextResponse.json({ error }, { status: result.reason === "unknown_class" ? 404 : 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
