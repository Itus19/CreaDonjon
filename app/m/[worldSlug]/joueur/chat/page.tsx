import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import ChatPanel from "@/components/shell/ChatPanel";

/** Onglet Chat (V2-M12, retour utilisateur : "ajoute un outil de chat avec le mj dans la liste des outils de joueur") — salon partage par campagne, meme composant que cote MJ. */
export default async function JoueurChatPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const campaignId = campaigns[0]?.id ?? null;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <ChatPanel campaignId={campaignId} />
    </div>
  );
}
