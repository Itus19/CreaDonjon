import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRulesetVariantSchema, setActiveRulesetSchema } from "@/lib/ruleset/schemas";
import { createRulesetVariant, listSelectableRulesetsForCurrentUser, setActiveRuleset } from "@/src/server/services/rules";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";

/**
 * Selection du ruleset actif d'un monde (V1-C5) : GET liste les rulesets
 * choisissables (officiels + variantes de l'utilisateur) et l'actif
 * courant, PATCH change l'actif, POST cree une nouvelle variante a partir
 * d'un ruleset officiel.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const [options, current] = await Promise.all([
    listSelectableRulesetsForCurrentUser(supabase),
    getWorldDefaultRulesetId(supabase, world.id),
  ]);
  if (options === null) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  return NextResponse.json({ options, current }, { status: 200 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = setActiveRulesetSchema.safeParse(body);
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

  const updated = await setActiveRuleset(supabase, worldSlug, parsed.data.rulesetId);
  if (!updated) {
    return NextResponse.json(
      { error: "Monde ou ruleset introuvable, ou vous n'êtes pas propriétaire de ce monde." },
      { status: 403 }
    );
  }
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  await params; // worldSlug non necessaire ici : une variante appartient a son createur, pas a un monde precis.

  const body = await request.json().catch(() => null);
  const parsed = createRulesetVariantSchema.safeParse(body);
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

  const variant = await createRulesetVariant(supabase, {
    name: parsed.data.name,
    parentRulesetId: parsed.data.parentRulesetId,
    personalReference: parsed.data.personalReference,
  });
  if (!variant) {
    return NextResponse.json({ error: "Ruleset parent introuvable." }, { status: 404 });
  }
  return NextResponse.json(variant, { status: 201 });
}
