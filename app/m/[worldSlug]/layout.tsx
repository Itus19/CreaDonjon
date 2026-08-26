import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import AppShell from "@/components/shell/AppShell";
import DesktopWindowsProvider from "@/components/shell/DesktopWindowsProvider";

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
  // ligne non supprimee, affichee a cote du nom du monde sur l'ecran MJ
  // (retour utilisateur) — voir AppShell.
  const campaigns = await listCampaigns(supabase, world.id);
  const campaignName = campaigns[0]?.name ?? null;

  return (
    // Etat des fenetres flottantes (ADR-0011), partage par Monde et Regles
    // — au-dessus d'AppShell (donc de SectionToggle aussi : basculer de
    // section doit pouvoir replier la fenetre primaire dans `avec` avant
    // de naviguer, sans quoi changer de section la ferme).
    <Suspense fallback={null}>
      <DesktopWindowsProvider worldSlug={world.slug}>
        <AppShell worldName={world.name} worldSlug={world.slug} campaignName={campaignName}>
          {children}
        </AppShell>
      </DesktopWindowsProvider>
    </Suspense>
  );
}
