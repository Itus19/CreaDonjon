import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
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

  return (
    <>
      <MjSidebar worldSlug={worldSlug} />
      <WindowsDesktop worldSlug={worldSlug}>{children}</WindowsDesktop>
    </>
  );
}
