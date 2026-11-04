import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { listDeclaredResources } from "@/src/server/services/rulePlayableBlocks";
import type { Locale } from "@/src/i18n/request";

/**
 * V3.1-132 — les ressources déclarées du ruleset actif (clé, libellé, règle
 * qui la déclare), pour le menu « Ressource dépensée » de l'éditeur de
 * briques. Réservé au MJ ; lue à l'ouverture de l'éditeur seulement.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
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

  const resources = await listDeclaredResources(supabase, { worldId: world.id, locale: (await getLocale()) as Locale });
  return NextResponse.json({ resources: resources ?? [] });
}
