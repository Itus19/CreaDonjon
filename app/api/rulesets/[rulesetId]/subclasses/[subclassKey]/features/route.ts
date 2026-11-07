import { NextResponse, type NextRequest } from "next/server";
import { ensureSubclassFeatureEntrySchema } from "@/lib/ruleset/schemas";
import { createClient } from "@/lib/supabase/server";
import { ensureSubclassFeatureEntry } from "@/src/server/services/rules";

/**
 * V3.1-181 — Crée (ou retrouve) la fiche qui porte les briques jouables
 * d'une aptitude de sous-classe, dans la variante `rulesetId`. Même forme que
 * `../route.ts` : l'identifiant vient de l'URL, le corps est validé par Zod,
 * et c'est la RPC `upsert_ruleset_override` qui refuse d'écrire dans une base
 * officielle ou dans la variante de quelqu'un d'autre (docs/SECURITE.md).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ rulesetId: string; subclassKey: string }> }) {
  const { rulesetId, subclassKey } = await params;

  const body = await request.json().catch(() => null);
  const parsed = ensureSubclassFeatureEntrySchema.safeParse(body && typeof body === "object" ? { ...body, rulesetId, subclassKey } : null);
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

  const result = await ensureSubclassFeatureEntry(supabase, parsed.data);
  if (!result.ok) {
    const error =
      result.reason === "not_subclass"
        ? "Cette sous-classe n'existe pas dans la variante active."
        : result.reason === "no_feature"
          ? "Cette aptitude n'existe pas dans la sous-classe."
          : (result.message ?? "Fiche de l'aptitude invalide.");
    return NextResponse.json({ error }, { status: result.reason === "invalid" ? 400 : 404 });
  }
  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}
