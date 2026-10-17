import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { countUnreadChatMessages } from "@/src/server/services/chat";
import { getCalendar, getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import AppShell from "@/components/shell/AppShell";
import DesktopWindowsProvider from "@/components/shell/DesktopWindowsProvider";
import VoletsLayer from "@/components/shell/VoletsLayer";
import WorldCalendarProvider from "@/components/shared/WorldCalendarProvider";

export default async function WorldLayout({
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

  // "Un monde = une campagne" (migration 20260826100001) : au plus une
  // ligne non supprimee. Depuis V2.1-16, seul l'identifiant sert ici (volet
  // de des, messages non lus) — le NOM de la campagne est affiche par la
  // barre laterale MJ, qui le relit elle-meme (`listCampaigns` est memoise
  // par requete, donc sans second aller-retour).
  // V3.1-48 : le calendrier du monde part dans la meme vague (une lecture
  // d'une colonne par rendu du layout, QUOTAS Q1) ; il alimente l'age derive
  // de la fiche et de l'assistant, sans `fetch` cote client.
  const [campaigns, user, calendar] = await Promise.all([
    listCampaigns(supabase, world.id),
    getAuthUser(supabase),
    getCalendar(supabase, world.id),
  ]);
  const campaignId = campaigns[0]?.id ?? null;
  // V3.1-62 (docs/CABLAGE.md, C1) : la pastille du chat est visible sur
  // toutes les pages du monde ; son compte arrive avec la page plutot que
  // par un appel `/api` apres l'affichage.
  const initialUnreadCount =
    campaignId && user ? await countUnreadChatMessages(supabase, { campaignId, worldId: world.id, userId: user.id }) : null;

  return (
    // Etat des fenetres du MJ (ADR-0011, ADR-0066), partage par Monde et Regles
    // — au-dessus d'AppShell (donc de SectionToggle aussi : basculer de
    // section doit pouvoir replier la fenetre primaire dans `avec` avant
    // de naviguer, sans quoi changer de section la ferme).
    <Suspense fallback={null}>
      <DesktopWindowsProvider worldSlug={world.slug}>
        <AppShell
          worldSlug={world.slug}
          campaignId={campaignId}
          initialUnreadCount={initialUnreadCount}
          overlay={<VoletsLayer worldSlug={world.slug} />}
        >
          <WorldCalendarProvider calendar={calendar}>{children}</WorldCalendarProvider>
        </AppShell>
      </DesktopWindowsProvider>
    </Suspense>
  );
}
