import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityTree } from "@/src/server/services/entities";
import { listCampaigns } from "@/src/server/services/campaigns";
import WikiBackgroundProvider from "@/components/entities/public/WikiBackgroundProvider";
import BookSkin from "@/components/entities/public/BookSkin";
import SessionJournalBanner from "@/components/shell/sessionJournal/SessionJournalBanner";

/**
 * Onglet Wiki (retour utilisateur 31 août) : "reprend exactement la
 * présentation du wiki public (liste des fiches à gauche, fiche
 * sélectionnée au centre)".
 *
 * V2.1-12 : il ne la « reprend » plus, il l'EST. Cet onglet réimplémentait
 * `BookSkin` avec `TwoPaneReaderLayout` + `PlayerWikiSidebar`, et la copie
 * n'avait pas emporté le fond de page — une image réglée « seulement en fond »
 * disparaissait donc sans que rien ne soit peint à sa place. Une seule peau
 * désormais, montée ici comme sur `/apercu` et servie par le même composant.
 *
 * `layout.tsx` (pas juste une page) : le sommaire reste monté d'une fiche à
 * l'autre, jamais reconstruit — `EntityTree`/`usePathname` retrouve seul la
 * sélection courante. C'est cette propriété qui a fait remonter `BookSkin`
 * dans les layouts des trois routes plutôt que de la sacrifier ici.
 *
 * `getEntityTree` (pas `getPublicEntityTree`) : client authentifié + RLS,
 * jamais le `service_role` confiné à `publicShare.ts` (CLAUDE.md règle 4ter)
 * — "notes" retiré du sommaire, déjà son propre onglet.
 */
export default async function JoueurWikiLayout({
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
  const user = await getAuthUser(supabase);

  const [tree, campaigns] = await Promise.all([
    getEntityTree(supabase, world.id, user?.id ?? null).then((groups) => groups.filter((g) => g.kind !== "notes")),
    listCampaigns(supabase, world.id),
  ]);
  const title = campaigns[0]?.name ?? world.name;

  return (
    <WikiBackgroundProvider>
      <BookSkin
        title={title}
        worldSlug={worldSlug}
        tree={tree}
        hrefBase={`/m/${worldSlug}/joueur/wiki`}
        banner={<SessionJournalBanner worldSlug={worldSlug} />}
      >
        {children}
      </BookSkin>
    </WikiBackgroundProvider>
  );
}
