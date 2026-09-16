import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPublicEntityTree, getPublicWikiBackground } from "@/src/server/services/publicShare";
import { EN_TETE_CHEMIN, entitySlugFromPathname } from "@/lib/wikiPath";
import WikiBackgroundProvider from "@/components/entities/public/WikiBackgroundProvider";
import BookSkin from "@/components/entities/public/BookSkin";

/**
 * Seul endroit qui persiste entre deux fiches d'un meme monde en apercu
 * (V2-G13 suite) : porte le fond de page wiki, pour qu'il puisse s'estomper
 * en quittant une fiche plutot que de couper net a chaque navigation — voir
 * `WikiBackgroundProvider.tsx`.
 *
 * V2.1-12 : porte aussi la COQUILLE (`BookSkin`), pour la meme raison. Elle
 * vivait dans chaque page, donc elle se reconstruisait a chaque fiche : la
 * recherche du sommaire se vidait, son defilement repartait de zero, et son
 * repli scintillait (lu depuis `localStorage` dans un effet, apres le premier
 * rendu). Le sommaire et le titre sont par MONDE — ils ont leur place ici. Le
 * fond, lui, est par fiche et reste declare par la page
 * (`WikiBackgroundRegistrar`).
 */
export default async function ApercuLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  // V2.1-20 lot 2.1 — voir `app/partage/[token]/layout.tsx` : même mécanisme,
  // même service. `/apercu` et `/partage` ne diffèrent que par la façon dont
  // le monde est résolu ; le fond, lui, vient du même `getPublicWikiBackground`.
  const entitySlug = entitySlugFromPathname((await headers()).get(EN_TETE_CHEMIN), `/m/${worldSlug}/apercu`);

  const [tree, campaigns, initialBackground] = await Promise.all([
    getPublicEntityTree(world.id),
    listCampaigns(supabase, world.id),
    entitySlug ? getPublicWikiBackground(world.id, entitySlug) : Promise.resolve(null),
  ]);
  const title = campaigns[0]?.name ?? world.name;

  return (
    <WikiBackgroundProvider initialBackground={initialBackground}>
      <BookSkin title={title} worldSlug={world.slug} tree={tree} hrefBase={`/m/${world.slug}/apercu`}>
        {children}
      </BookSkin>
    </WikiBackgroundProvider>
  );
}
