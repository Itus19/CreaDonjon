import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { getEntityById } from "@/src/server/repos/entities";
import { getEntityWindowData } from "@/src/server/services/entityWindow";
import EditEntityForm from "../(monde)/f/[entitySlug]/EditEntityForm";

/**
 * Onglet Fiche (V2-M7b, coquille joueur) — reutilise `EditEntityForm` tel
 * quel : c'est deja sa PROPRE fiche PJ (`canEditEntity`, cas 3), en
 * ecriture complete comme aujourd'hui, rien de nouveau a construire ici.
 * "Un monde = une campagne" (migration 20260826100001) : au plus une ligne.
 */
export default async function JoueurFichePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const campaign = campaigns[0] ?? null;
  const entityId = campaign ? await getClaimedCharacterEntityId(supabase, { campaignId: campaign.id, userId: user.id }) : null;
  if (!entityId) {
    return <p className="text-sm text-ink-muted">Aucun personnage réclamé pour l&apos;instant dans ce monde.</p>;
  }
  const entity = await getEntityById(supabase, entityId);
  if (!entity) notFound();

  const data = await getEntityWindowData(supabase, worldSlug, entity.slug);
  if (!data) notFound();

  return (
    <EditEntityForm
      entity={data.entity}
      worldSlug={data.worldSlug}
      initialBlocks={data.blocks}
      initialRelations={data.relations}
      otherEntities={data.otherEntities}
      worldCustomKinds={data.worldCustomKinds}
      campaignId={data.campaignId}
      initialIsPc={data.isPc}
      campaignCharacterUserId={data.campaignCharacterUserId}
      initialPortraitLayout={data.portraitLayout}
      playerRestricted
    />
  );
}
