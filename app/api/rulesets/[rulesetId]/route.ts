import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { deleteRulesetVariant, deleteRulesetVariantFromWorld } from "@/src/server/services/rules";

const zParams = z.object({ rulesetId: z.string().uuid() });
/** V3.1-57 : `?worldSlug=` — supprimée depuis l'écran Règles actives de ce monde, la variante active cède la place à sa base. */
const zQuery = z.object({ worldSlug: z.string().min(1).max(200).optional() });

/** Suppression d'une variante de ruleset (V1-C5 suite) — jamais un officiel, voir deleteRulesetVariant. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ rulesetId: string }> }) {
  const parsedParams = zParams.safeParse(await params);
  if (!parsedParams.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const parsedQuery = zQuery.safeParse({ worldSlug: request.nextUrl.searchParams.get("worldSlug") ?? undefined });
  if (!parsedQuery.success) return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  const { rulesetId } = parsedParams.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const worldSlug = parsedQuery.data.worldSlug;
  const outcome = worldSlug ? await deleteRulesetVariantFromWorld(supabase, { worldSlug, rulesetId }) : await deleteRulesetVariant(supabase, rulesetId);
  if (outcome === "not_found") {
    return NextResponse.json({ error: "Ruleset introuvable, officiel, ou vous n'en êtes pas propriétaire." }, { status: 404 });
  }
  if (outcome === "forbidden") {
    return NextResponse.json({ error: "Seul le propriétaire du monde change son ruleset." }, { status: 403 });
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
