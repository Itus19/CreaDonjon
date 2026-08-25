import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import RulesSidebar from "@/components/rules/RulesSidebar";
import WindowsDesktop from "@/components/shell/WindowsDesktop";

/**
 * La liste des regles est desormais recuperee cote client par
 * `RulesSidebar` (`useWorldRuleEntries`, deja utilise ailleurs dans
 * l'application) plutot que passee en props par ce layout serveur — sinon
 * chaque page du monde paierait le cout de cette liste (mesure a 1.4-1.8s
 * sous le SRD 2024, V2-G1) meme en ne visitant jamais Regles, une fois le
 * gestionnaire de fenetres commun aux trois sections (ADR-0011).
 */
export default async function ReglesLayout({
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
      <RulesSidebar worldSlug={worldSlug} />
      <WindowsDesktop worldSlug={worldSlug}>{children}</WindowsDesktop>
    </>
  );
}
