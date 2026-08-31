import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityBySlug } from "@/src/server/repos/entities";
import { listVisibleBlocks } from "@/src/server/services/blocks";
import { canUserEditEntity } from "@/src/server/services/permissions";
import { getEntityWindowData } from "@/src/server/services/entityWindow";
import PlayerBlockView from "@/components/entities/player/PlayerBlockView";
import EditEntityForm from "../../../(monde)/f/[entitySlug]/EditEntityForm";

/**
 * Fiche du Wiki (V2-M7b, coquille joueur) — lecture seule PAR DEFAUT
 * (`listVisibleBlocks` + `PlayerBlockView`, jamais d'affordance d'edition),
 * SAUF si `canEditEntity` autorise ce viewer sur CETTE fiche precise
 * (retour utilisateur : "le joueur a toujours le droit d'edition sur sa
 * propre fiche" — deja vrai via canEditEntity cas 3 — "et sur une fiche de
 * lore accordee par le MJ" — cas 4, `entity_grants`). Sans ce test, la
 * seule facon d'editer sa propre fiche restait l'onglet Fiche, et une
 * fiche de lore accordee via le panneau MJ (V2-M7, "Octrois d'edition")
 * n'etait JAMAIS editable depuis la coquille joueur — aucun autre chemin
 * n'y menait.
 */
export default async function JoueurWikiEntityPage({
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

  if (canEdit) {
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

  const blocks = await listVisibleBlocks(supabase, world.id, entity.id, user.id);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">{entity.name}</h2>
      {blocks.length === 0 ? (
        <p className="text-sm text-ink-muted">Rien de visible pour l&apos;instant.</p>
      ) : (
        blocks.map((block) => <PlayerBlockView key={block.id} block={block} />)
      )}
    </div>
  );
}
