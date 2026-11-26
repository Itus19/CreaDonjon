import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncRulesetCopyEntrySchema } from "@/lib/ruleset/schemas";
import { syncRulesetCopy } from "@/src/server/services/rules";

/**
 * AG-18 (ADR 0106) — « mise à jour disponible » : reprendre une règle de la
 * source dans la copie active du monde, ou garder la sienne. Une règle par
 * requête. La base refuse la copie d'un autre compte (la RPC lève une
 * erreur, rendue en 404 ici comme une copie introuvable).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = syncRulesetCopyEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  let outcome: Awaited<ReturnType<typeof syncRulesetCopy>>;
  try {
    outcome = await syncRulesetCopy(supabase, { worldSlug, ...parsed.data });
  } catch (e) {
    console.error("Mise à jour de la copie de ruleset impossible", e);
    return NextResponse.json({ error: "Copie de ruleset introuvable." }, { status: 404 });
  }
  if (outcome === "not_found") return NextResponse.json({ error: "Copie de ruleset introuvable." }, { status: 404 });
  if (outcome === "stale") return NextResponse.json({ error: "La règle a encore changé dans la source : rechargez la page." }, { status: 409 });
  return NextResponse.json({ ok: true }, { status: 200 });
}
