import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import SchedulingMjPanel from "@/components/shell/scheduling/SchedulingMjPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Outil MJ "Calendrier réel" (V2.1-4) — distinct du "Calendrier ingame"
 * (dates de fiction, `mj/calendrier`) : planification réelle des séances,
 * disponibilités des joueuses, historique des parties jouées.
 */
export default async function MjCalendrierReelPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const campaignId = await resolveCampaignId(supabase, world.id);

  return (
    <div className="flex flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "calendrier-reel" }} name="Calendrier réel" badge="" homeHref={`/m/${worldSlug}/mj/calendrier-reel`} />
      <div>
        <h1 className="block-title text-base">Calendrier réel</h1>
        <p className="text-xs text-ink-muted">Planifiez la prochaine séance à partir des disponibilités des joueuses, ou réglez une date manuellement.</p>
      </div>
      {campaignId ? (
        <SchedulingMjPanel campaignId={campaignId} />
      ) : (
        <p className="text-sm italic text-ink-muted">Ce monde n&apos;a pas encore de campagne.</p>
      )}
    </div>
  );
}
