import { NextResponse, type NextRequest } from "next/server";
import { createRulesetFromImportSchema } from "@/lib/ruleset/schemas";
import { createClient } from "@/lib/supabase/server";
import { createRulesetFromImport } from "@/src/server/services/rules";

/**
 * Import "notre format" → NOUVEAU ruleset personnel (V2-J4) — distinct de
 * `POST /api/rulesets/[rulesetId]/import` (qui ajoute dans une variante déjà
 * active, comportement inchangé) : ce fichier porte lui-même son nom et son
 * `baseSystem` (même forme que `GET /api/rulesets/[rulesetId]/export`),
 * jamais besoin de choisir une variante au préalable. Le ruleset créé est
 * `content_origin: 'personal_reference'` (`createRulesetVariant`,
 * `personalReference: true`) — les verrous de partage existent déjà en
 * base (triggers `forbid_share_personal_ruleset`/
 * `forbid_personal_reference_downgrade`), rien à réécrire ici.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createRulesetFromImportSchema.safeParse(body);
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

  const created = await createRulesetFromImport(supabase, parsed.data);
  if (!created.ok) {
    if (created.reason === "unknown_base_system") {
      return NextResponse.json({ error: "Système de base inconnu — ce fichier ne correspond à aucun ruleset officiel de ce serveur." }, { status: 400 });
    }
    return NextResponse.json({ error: "Impossible de créer le ruleset." }, { status: 403 });
  }

  return NextResponse.json(created.result, { status: 201 });
}
