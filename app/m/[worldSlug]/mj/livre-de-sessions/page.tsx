import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug, getCalendar } from "@/src/server/services/worlds";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import SessionJournalMjPanel from "@/components/shell/sessionJournal/SessionJournalMjPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Outil MJ "Livre de sessions" (V2.1-3) — assigne le devoir de rédiger le
 * récit d'une séance à une joueuse ; l'entrée elle-même est une fiche
 * normale, rédigée et corrigée depuis le wiki comme n'importe quelle autre.
 */
export default async function MjLivreDeSessionsPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const [campaignId, calendar] = await Promise.all([resolveCampaignId(supabase, world.id), getCalendar(supabase, world.id)]);

  return (
    <div className="flex flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "livre-de-sessions" }} name="Livre de sessions" badge="" homeHref={`/m/${worldSlug}/mj/livre-de-sessions`} />
      <div>
        <h1 className="block-title text-base">Livre de sessions</h1>
        <p className="text-xs text-ink-muted">Assignez le récit d&apos;une séance à une joueuse — elle rédige, vous pouvez toujours corriger ensuite.</p>
      </div>
      {campaignId ? (
        <SessionJournalMjPanel campaignId={campaignId} initialCalendar={calendar} />
      ) : (
        <p className="text-sm italic text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>
      )}
    </div>
  );
}
