import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { setScene, loadSceneView } from "@/src/server/services/soloScene";

/**
 * V3-B2 — Poser la scene : ou l'on est, et qui est la.
 *
 * Aucune verification de droits propre ici : la RLS de `scene_states` est
 * alignee sur la campagne (SCHEMA.md §26, `app.is_world_admin` en
 * ecriture). Une regle d'autorisation ecrite en double finirait par
 * diverger de celle de la base — c'est la base qui tranche.
 */
const bodySchema = z.object({
  campaignId: z.string().uuid(),
  locationId: z.string().uuid(),
  present: z.array(z.string().uuid()).max(20),
});

export async function POST(request: NextRequest) {
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

  try {
    await setScene(supabase, { ...parsed.data, callerId: user.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "La scène n'a pas pu être enregistrée." },
      { status: 400 },
    );
  }

  const view = await loadSceneView(supabase, parsed.data.campaignId);
  return NextResponse.json(view, { status: 200 });
}
