import { NextResponse, type NextRequest } from "next/server";
import { importRulesetEntriesSchema } from "@/lib/ruleset/schemas";
import { createClient } from "@/lib/supabase/server";
import { importRulesetEntries } from "@/src/server/services/rules";

/**
 * Import JSON de regles dans une variante (retour utilisateur, "regles
 * actives") — `rulesetId` vient de l'URL, pas du corps (coherent avec les
 * autres routes de ce dossier) ; le corps accepte `{ entries: [...] }` OU un
 * tableau nu, pour qu'un fichier prepare a la main n'ait pas a se souvenir
 * de l'enveloppe exacte. Ecarte une entree invalide plutot que rejeter tout
 * le fichier — voir `importRulesetEntries`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ rulesetId: string }> }) {
  const { rulesetId } = await params;

  const body = await request.json().catch(() => null);
  const normalized = Array.isArray(body) ? { rulesetId, entries: body } : body && typeof body === "object" ? { ...body, rulesetId } : null;
  const parsed = importRulesetEntriesSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Fichier invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const result = await importRulesetEntries(supabase, parsed.data);
  return NextResponse.json(result, { status: 200 });
}
