import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getOrOpenSessionForCampaign } from "@/src/server/services/sessions";
import { promoteSketch } from "@/src/server/services/sceneSketches";
import { loadSceneView } from "@/src/server/services/soloScene";

/**
 * V3-C2 — « Garder cette fiche » : le déclencheur MANUEL d'ancrage, posé à
 * côté des trois automatiques (nommée, parlé plus de trois fois, revue dans
 * un second lieu — `sceneSketches.ts`). Même mécanisme (`promoteToEntity`)
 * que les trois autres, jamais un second chemin de création de fiche.
 */
const bodySchema = z.object({
  campaignId: z.string().uuid(),
  worldSlug: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ sketchId: string }> }) {
  const { sketchId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
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

  const world = await getWorldBySlug(supabase, parsed.data.worldSlug);
  if (!world) {
    return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });
  }

  const sessionId = await getOrOpenSessionForCampaign(supabase, parsed.data.campaignId);
  const promoted = await promoteSketch(supabase, { campaignId: parsed.data.campaignId, worldId: world.id, sessionId, sketchId, callerId: user.id });
  if (!promoted.ok) {
    const status = promoted.reason === "not_found" ? 404 : 403;
    return NextResponse.json({ error: promoted.reason === "not_found" ? "Esquisse introuvable." : "Vous n'avez pas le droit d'ancrer cette esquisse." }, { status });
  }

  const view = await loadSceneView(supabase, { campaignId: parsed.data.campaignId, worldId: world.id });
  return NextResponse.json({ entityId: promoted.entity.id, entitySlug: promoted.entity.slug, scene: view }, { status: 200 });
}
