import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import ChatThreadsPanel from "@/components/shell/ChatThreadsPanel";

/** Onglet Chat (V2-M12/M13, V3.1-22) — page pleine du joueur : liste « Conversations » (salon de table, MJ en prive) et la conversation choisie. */
export default async function JoueurChatPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const campaignId = campaigns[0]?.id ?? null;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col">
      <ChatThreadsPanel campaignId={campaignId} role="joueur" />
    </div>
  );
}
