import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { resolveCampaignId, hasHumanGm } from "@/src/server/services/campaigns";
import { countUnansweredRequests, getNextSession } from "@/src/server/services/scheduling";
import PlayerShell from "@/components/shell/PlayerShell";
import { getMyOpenDevoir } from "@/src/server/services/sessionJournal";

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
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) redirect("/");

  const campaignId = await resolveCampaignId(supabase, world.id);
  // V3.1-62 (docs/CABLAGE.md, C1) : le badge « Prochaine session » est
  // toujours visible ; ses donnees arrivent avec la page, en une vague,
  // au lieu de deux appels `/api` apres l'affichage sur chaque page joueuse.
  // V3.1-150 : le devoir de journal (sous « Édition », dans le rail) part
  // dans la même vague ; le calendrier ne se lit que si un devoir existe.
  // V3.1-190 : le nombre de demandes qui attendent ma réponse (la pastille),
  // dans la même vague — quatre lectures légères quel que soit le nombre de
  // demandes (`countUnansweredRequests`).
  const [humanGm, nextSession, demandesEnAttente, devoir] = await Promise.all([
    campaignId ? hasHumanGm(supabase, campaignId) : Promise.resolve(false),
    campaignId ? getNextSession(supabase, campaignId) : Promise.resolve(null),
    campaignId ? countUnansweredRequests(supabase, campaignId, user.id) : Promise.resolve(0),
    campaignId ? getMyOpenDevoir(supabase, { worldId: world.id, campaignId, userId: user.id }) : Promise.resolve(null),
  ]);
  const prochaineSession = campaignId ? { date: nextSession?.scheduled_date ?? null, demandesEnAttente } : null;

  return (
    <PlayerShell worldSlug={worldSlug} worldName={world.name} hasHumanGm={humanGm} prochaineSession={prochaineSession} devoir={devoir}>
      {children}
    </PlayerShell>
  );
}
