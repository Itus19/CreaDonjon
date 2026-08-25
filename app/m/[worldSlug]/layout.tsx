import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
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

  return (
    // Etat des fenetres flottantes (ADR-0011), partage par Monde et Regles
    // — au-dessus d'AppShell (donc de SectionToggle aussi : basculer de
    // section doit pouvoir replier la fenetre primaire dans `avec` avant
    // de naviguer, sans quoi changer de section la ferme).
    <Suspense fallback={null}>
      <DesktopWindowsProvider worldSlug={world.slug}>
        <AppShell worldName={world.name} worldSlug={world.slug}>
          {children}
        </AppShell>
      </DesktopWindowsProvider>
    </Suspense>
  );
}
