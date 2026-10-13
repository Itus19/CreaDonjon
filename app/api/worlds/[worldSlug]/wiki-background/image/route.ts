import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { worldRouteParamsSchema } from "@/lib/worlds/schemas";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { readWorldWikiBackground } from "@/src/server/services/worldWikiBackground";
import { getSignedAssetUrl, SIGNED_URL_CACHE_HEADER } from "@/src/server/services/storage";

/**
 * V3.1-59 (ADR 0047) — l'image du fond par défaut du wiki, pour un MEMBRE du
 * monde (onglet Wiki des joueuses, aperçu du MJ). Client de l'appelant : la
 * RLS des mondes et des assets fait la garde.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const route = worldRouteParamsSchema.safeParse(await params);
  if (!route.success) return NextResponse.json({ error: "Adresse invalide." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const world = await getWorldBySlug(supabase, route.data.worldSlug);
  if (!world) return NextResponse.json({ error: "Image introuvable." }, { status: 404 });

  const setting = await readWorldWikiBackground(supabase, world.id);
  const url = setting?.source === "world_asset" ? await getSignedAssetUrl(supabase, setting.assetId) : null;
  if (!url) return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": SIGNED_URL_CACHE_HEADER } });
}
