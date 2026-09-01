import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityTree } from "@/src/server/services/entities";
import PlayerWikiSidebar from "@/components/shell/PlayerWikiSidebar";
import TwoPaneReaderLayout from "@/components/shell/TwoPaneReaderLayout";

/**
 * Onglet Wiki (retour utilisateur 31 août) : "reprend exactement la
 * présentation du wiki public (liste des fiches à gauche, fiche
 * sélectionnée au centre)" — meme disposition que `BookSkin.tsx`
 * (sommaire + fiche a `max-w-[70ch]`), sommaire plus etroit sur demande
 * explicite. `layout.tsx` (pas juste une page) : le sommaire reste monte
 * d'une fiche a l'autre, jamais reconstruit — `EntityTree`/`usePathname`
 * retrouve seul la selection courante, meme mecanisme que BookSkin.
 *
 * `getEntityTree` (pas `getPublicEntityTree`) : client authentifie + RLS,
 * jamais le `service_role` confine a `publicShare.ts` (CLAUDE.md regle
 * 4ter) — "notes" retire du sommaire, deja son propre onglet.
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

  const tree = (await getEntityTree(supabase, world.id, user?.id ?? null)).filter((g) => g.kind !== "notes");

  return (
    <TwoPaneReaderLayout sidebar={<PlayerWikiSidebar worldSlug={worldSlug} tree={tree} />}>{children}</TwoPaneReaderLayout>
  );
}
