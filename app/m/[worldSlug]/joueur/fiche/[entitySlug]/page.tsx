import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityBySlug } from "@/src/server/repos/entities";
import { canUserEditEntity } from "@/src/server/services/permissions";
import { getEntityWindowData } from "@/src/server/services/entityWindow";
import EditEntityForm from "../../../(monde)/f/[entitySlug]/EditEntityForm";

/**
 * Fiche d'une entree de l'outil Édition (V2-M13) — toujours en edition
 * (`EditEntityForm`, `playerRestricted`), jamais un mode lecture : ce
 * n'est atteignable que via le sommaire `PlayerEditableEntitiesSidebar`
 * (uniquement des fiches editables) ou une URL directe. Une URL directe
 * vers une fiche que ce joueur ne peut PAS editer renvoie au Wiki (meme
 * garde que les autres redirections joueur de cette session), jamais une
 * page blanche ni une fuite de donnees (le contenu reste filtre par
 * visibilite cote Wiki de toute facon).
 */
export default async function JoueurFicheEntityPage({
  params,
}: {
  params: Promise<{ worldSlug: string; entitySlug: string }>;
}) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const entity = await getEntityBySlug(supabase, world.id, entitySlug);
  if (!entity) notFound();

  const canEdit = await canUserEditEntity(supabase, { worldId: world.id, entityId: entity.id, userId: user.id });
  if (!canEdit) {
    redirect(`/m/${worldSlug}/joueur/wiki/${entitySlug}`);
  }

  const data = await getEntityWindowData(supabase, worldSlug, entitySlug);
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
