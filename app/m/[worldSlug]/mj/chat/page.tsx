import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import ChatPanel from "@/components/shell/ChatPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/** Outil Chat (V2-M12, retour utilisateur : "ajoute un outil de chat avec le mj") — salon partage par campagne, cote MJ. `mj/layout.tsx` reserve deja toute la section au vrai MJ du monde. */
export default async function MjChatPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const campaignId = campaigns[0]?.id ?? null;

  return (
    <div className="flex h-full flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "chat" }} name="Chat" badge="" homeHref={`/m/${worldSlug}/mj/chat`} />
      <ChatPanel campaignId={campaignId} />
    </div>
  );
}
