import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteRulesetVariant } from "@/src/server/services/rules";

/** Suppression d'une variante de ruleset (V1-C5 suite) — jamais un officiel, voir deleteRulesetVariant. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ rulesetId: string }> }) {
  const { rulesetId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const outcome = await deleteRulesetVariant(supabase, rulesetId);
  if (outcome === "not_found") {
    return NextResponse.json({ error: "Ruleset introuvable, officiel, ou vous n'en êtes pas propriétaire." }, { status: 404 });
  }
  if (outcome === "in_use") {
    return NextResponse.json(
      {
        error:
          "Cette variante est utilisée par un monde ou une campagne (ou sert de base à une autre variante) : elle ne peut pas être supprimée tant qu'elle est utilisée.",
      },
      { status: 409 }
    );
  }
  return new NextResponse(null, { status: 204 });
}
