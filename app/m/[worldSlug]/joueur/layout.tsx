import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import PlayerShell from "@/components/shell/PlayerShell";

/**
 * Coquille joueur (V2-M7b) — a l'ecart de `MondeShell`/`WindowsDesktop`
 * (paradigme fenetres flottantes, desktop uniquement) : herite
 * `AppShell`/`DesktopWindowsProvider` du layout parent
 * (`app/m/[worldSlug]/layout.tsx`, inevitable en Next.js App Router,
 * imbrication par dossier) mais ne les utilise jamais — `WindowsDesktop`
 * sans fenetre enregistree rend simplement ses enfants (verifie en lisant
 * le code, `WindowsDesktop.tsx`).
 */
export default async function JoueurLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) redirect("/");

  return <PlayerShell worldSlug={worldSlug}>{children}</PlayerShell>;
}
