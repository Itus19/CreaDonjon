import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { isWorldAdmin } from "@/src/server/services/permissions";
import MjSidebar from "@/components/shell/MjSidebar";
import WindowsDesktop from "@/components/shell/WindowsDesktop";

/**
 * Outils MJ en fenetres flottantes (retour utilisateur, V2-M7 suite : "les
 * fenetres des outils MJ [...] comme celles des regles ou du wiki") — meme
 * `WindowsDesktop` que Monde/Regles, memes fenetres visibles quelle que
 * soit la section (`DesktopWindowsProvider`, partage au-dessus des trois
 * dans `app/m/[worldSlug]/layout.tsx`). Le `<Panel>` plein cadre a disparu :
 * `WindowsDesktop` le rend lui-meme quand aucune fenetre primaire n'est
 * ouverte.
 *
 * Reserve au MJ reel de ce monde (retour utilisateur : "je ne comprend pas
 * pourquoi elle a un acces MJ alors que c'est bien mentionne que c'est une
 * joueuse") — bug reel trouve en verifiant : aucune des pages `mj/**` ne
 * verifiait `isWorldAdmin` avant de s'afficher (seul `journal-historique`
 * le faisait, et seulement pour masquer son propre contenu, jamais pour
 * bloquer la page). Une simple invitee "Joueur" qui ouvrait l'onglet MJ
 * (toujours visible dans `SectionToggle`, aucune condition de role) voyait
 * donc la liste des membres, le formulaire d'invitation et l'attribution de
 * personnages — meme si ses tentatives d'ecriture auraient fini par
 * echouer cote RLS, l'affichage lui-meme n'aurait jamais du avoir lieu.
 * Verifie ici UNE fois pour toute la section plutot que par page — memes
 * outils actuels et futurs converts automatiquement.
 */
export default async function MjLayout({
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
  const gm = user ? await isWorldAdmin(supabase, { worldId: world.id, userId: user.id }) : false;
  if (!gm) {
    return (
      <div className="flex-1 p-8">
        <p className="text-sm text-ink-muted">Réservé au MJ de ce monde.</p>
      </div>
    );
  }

  return (
    <>
      <MjSidebar worldSlug={worldSlug} />
      <WindowsDesktop worldSlug={worldSlug}>{children}</WindowsDesktop>
    </>
  );
}
