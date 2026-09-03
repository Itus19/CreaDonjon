import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { promoteGeneratorResultSchema } from "@/lib/generators/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { resolveBlockReferences } from "@/src/server/services/referenceChips";
import { promoteToEntity, type PromotedBlockSpec } from "@/src/server/services/promotion";
import { GENERATOR_TOOLS } from "@/src/core/generators/tools";
import type { Locale } from "@/src/i18n/request";

/**
 * "Créer la fiche" depuis l'outil MJ "Générateurs" (V2-J2) — promeut le
 * resultat actuellement affiche (envoye par le client, le serveur de
 * tirage restant sans etat) en une vraie entite. Reserve au MJ, meme garde
 * que `GET .../mj/[tool]/window` (l'outil lui-meme est cache aux joueurs).
 * Le mecanisme d'ecriture est generique (`promoteToEntity`,
 * src/server/services/promotion.ts) — cette route ne fait que traduire la
 * configuration du registre (`GENERATOR_TOOLS`) et resoudre les labels des
 * references avant de l'appeler.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ worldSlug: string; toolKey: string }> }) {
  const { worldSlug, toolKey } = await params;

  const tool = GENERATOR_TOOLS.find((t) => t.key === toolKey);
  if (!tool || !tool.promote) {
    return NextResponse.json({ error: "Cet outil ne peut pas encore créer de fiche." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = promoteGeneratorResultSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const gm = user ? await isWorldAdmin(supabase, { worldId: world.id, userId: user.id }) : false;
  if (!gm || !user) {
    return NextResponse.json({ error: "Réservé au MJ de ce monde." }, { status: 403 });
  }

  const nameResult = parsed.data.sections[tool.promote.nameSectionKey];
  if (!nameResult || nameResult.text.trim() === "") {
    return NextResponse.json({ error: "Tirez d'abord le nom avant de créer la fiche." }, { status: 400 });
  }

  const bodySections = tool.sections.filter((s) => s.key !== tool.promote!.nameSectionKey);
  const allRefs = bodySections.flatMap((s) => parsed.data.sections[s.key]?.refs ?? []);

  let chipByKey = new Map<string, string>();
  if (allRefs.length > 0) {
    const rulesetId = await getWorldDefaultRulesetId(supabase, world.id);
    const locale = (await getLocale()) as Locale;
    const chips = await resolveBlockReferences(supabase, world, rulesetId, locale, allRefs);
    chipByKey = new Map(chips.map((c) => [`${c.kind}:${c.key}`, c.name]));
  }

  const blocks: PromotedBlockSpec[] = bodySections.flatMap((section) => {
    const result = parsed.data.sections[section.key];
    if (!result || (result.text.trim() === "" && result.refs.length === 0)) return [];
    return [
      {
        label: section.label,
        text: result.text,
        refNodes: result.refs.map((ref) =>
          ref.kind === "rule"
            ? { kind: "rule" as const, key: ref.key, label: chipByKey.get(`rule:${ref.key}`) ?? ref.key }
            : { kind: "entity" as const, id: ref.id, label: chipByKey.get(`entity:${ref.id}`) ?? ref.id }
        ),
      },
    ];
  });

  const promoted = await promoteToEntity(supabase, {
    worldId: world.id,
    createdBy: user.id,
    name: nameResult.text,
    entityKind: tool.promote.entityKind,
    visibilityLevel: "public",
    visibilityScopeId: null,
    blocks,
  });
  if (!promoted.ok) {
    return NextResponse.json({ error: "Impossible de créer la fiche." }, { status: 403 });
  }

  return NextResponse.json({ entityId: promoted.entity.id, entitySlug: promoted.entity.slug }, { status: 201 });
}
