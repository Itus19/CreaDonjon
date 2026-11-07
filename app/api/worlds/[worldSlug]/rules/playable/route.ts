import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { savePlayableBlocks } from "@/src/server/services/rulePlayableBlocks";
import { zActivationBlockData, zCoverageBlockData, zRuleResourcesBlockData } from "@/src/core/schemas/rule-blocks/playable";
import { zForcedSaveFailuresBlockData } from "@/src/core/schemas/rule-blocks/blocks";

/** Absent : le bloc ne change pas ; `null` : il est retiré. */
const bodySchema = z
  .object({
    entryKey: z.string().trim().min(1).max(200),
    resources: zRuleResourcesBlockData.nullable().optional(),
    activation: zActivationBlockData.nullable().optional(),
    coverage: zCoverageBlockData.nullable().optional(),
    // V3.1-186 : les échecs automatiques d'une sauvegarde (Mante de majesté).
    forced_save_failures: zForcedSaveFailuresBlockData.nullable().optional(),
  })
  .strict();

const MESSAGES = {
  no_variant: "Choisis d'abord une variante (« Règles actives ») : une règle officielle ne se modifie jamais.",
  not_found: "Règle introuvable.",
  invalid: "Les briques ne sont pas valides.",
} as const;

/**
 * V3.1-132 — l'éditeur de briques enregistre les blocs `resources`,
 * `activation` et `coverage` d'une règle, en surcharge dans la variante
 * active du monde (jamais dans l'officielle, règle 18). Réservé au MJ.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Corps invalide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  if (!(await isWorldAdmin(supabase, { worldId: world.id, userId: user.id }))) {
    return NextResponse.json({ error: "Réservé au MJ de ce monde." }, { status: 403 });
  }

  const { entryKey, ...blocks } = parsed.data;
  const result = await savePlayableBlocks(supabase, { worldId: world.id, entryKey, blocks });
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "invalid" ? 400 : 409;
    return NextResponse.json({ error: result.message ?? MESSAGES[result.reason], reason: result.reason }, { status });
  }
  return NextResponse.json(result);
}
