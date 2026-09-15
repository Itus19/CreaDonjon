import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPublicEntityTree } from "@/src/server/services/publicShare";
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

  const [tree, campaigns] = await Promise.all([getPublicEntityTree(world.id), listCampaigns(supabase, world.id)]);
  const title = campaigns[0]?.name ?? world.name;

  return (
    <WikiBackgroundProvider>
      <BookSkin title={title} worldSlug={world.slug} tree={tree} hrefBase={`/m/${world.slug}/apercu`}>
        {children}
      </BookSkin>
    </WikiBackgroundProvider>
  );
}
