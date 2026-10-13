import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { worldRouteParamsSchema } from "@/lib/worlds/schemas";
import { zWikiBackgroundInput } from "@/src/core/theme/worldWikiBackground";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { setWorldWikiBackgroundByGm } from "@/src/server/services/worldWikiBackground";

const ERREURS = {
  forbidden: { message: "Seul le MJ choisit le fond du wiki.", status: 403 },
  not_found: { message: "Ce fond n'existe pas, ou n'est pas dans votre bibliothèque.", status: 404 },
  invalid_mode: { message: "Ce fond ne permet pas ce mode de page.", status: 400 },
} as const;

/**
 * V3.1-59 (ADR 0047) — le MJ choisit le fond par défaut du wiki : un fond
 * fourni, une image de sa bibliothèque (copiée dans le monde), ou aucun.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const route = worldRouteParamsSchema.safeParse(await params);
  if (!route.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });
  const body = zWikiBackgroundInput.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const world = await getWorldBySlug(supabase, route.data.worldSlug);
  if (!world) return NextResponse.json({ error: "Monde introuvable." }, { status: 404 });

  const result = await setWorldWikiBackgroundByGm(supabase, { worldId: world.id, userId: user.id, input: body.data });
  if (!result.ok) return NextResponse.json({ error: ERREURS[result.reason].message }, { status: ERREURS[result.reason].status });
  return NextResponse.json({ setting: result.setting }, { status: 200 });
}
