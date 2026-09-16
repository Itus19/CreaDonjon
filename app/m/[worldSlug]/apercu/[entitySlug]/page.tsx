import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getPublicEntityDetail } from "@/src/server/services/publicShare";
import type { Locale } from "@/src/i18n/request";
import PublicEntityBody from "@/components/entities/public/PublicEntityBody";
import { WikiBackgroundRegistrar } from "@/components/entities/public/WikiBackgroundProvider";
import WikiBackgroundPreload from "@/components/entities/public/WikiBackgroundPreload";

/**
 * Voir `app/m/[worldSlug]/apercu/page.tsx` — même principe, une fiche précise.
 *
 * V2.1-12 : la peau (`BookSkin`) est montée par `layout.tsx` ; cette page ne
 * rend que le contenu de la colonne de lecture, et déclare le fond de CETTE
 * fiche — la seule chose ici qui change d'une fiche à l'autre.
 */
export default async function ApercuEntityPage({
  params,
}: {
  params: Promise<{ worldSlug: string; entitySlug: string }>;
}) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const detail = await getPublicEntityDetail(world.id, entitySlug, (await getLocale()) as Locale);
  if (!detail) notFound();

  return (
    <>
      <WikiBackgroundPreload background={detail.wikiBackground} />
      <WikiBackgroundRegistrar background={detail.wikiBackground} />
      <p className="mb-1 font-mech text-xs text-ink-muted">Prévisualisation — vue d&apos;un visiteur anonyme</p>
      <PublicEntityBody {...detail} hrefBase={`/m/${world.slug}/apercu`} />
    </>
  );
}
