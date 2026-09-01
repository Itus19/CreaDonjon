import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getEntityWindowData } from "@/src/server/services/entityWindow";
import { isPlayerOnlyInWorld } from "@/src/server/services/permissions";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import EditEntityForm from "./EditEntityForm";

/**
 * Retour utilisateur : "quand un joueur utilise les hyperliens... ils
 * arrivent dans un écran de MJ" — cette page (coquille Monde plein cadre,
 * `EditEntityForm`) ne verifiait aucun role avant de s'afficher, meme bug
 * que la section MJ (`mj/layout.tsx`) trouve plus tot. Une viewer qui n'est
 * QUE joueuse de ce monde est renvoyee vers l'equivalent cote coquille
 * joueur — la fiche elle-meme reste deja filtree par visibilite
 * (`listVisibleBlocks`, dans `getEntityWindowData`), ce garde ne corrige
 * que le CHROME, jamais un second filtrage de donnees.
 */
export default async function EntityPage({
  params,
}: {
  params: Promise<{ worldSlug: string; entitySlug: string }>;
}) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const data = await getEntityWindowData(supabase, worldSlug, entitySlug);
  if (!data) notFound();

  const user = await getAuthUser(supabase);
  if (user && (await isPlayerOnlyInWorld(supabase, { worldId: data.entity.world_id, userId: user.id }))) {
    redirect(`/m/${worldSlug}/joueur/wiki/${entitySlug}`);
  }

  return (
    <>
      <RegisterPrimaryWindow
        windowRef={{ kind: "entity", key: data.entity.slug }}
        name={data.entity.name}
        badge={data.entity.entity_kind}
        homeHref={`/m/${worldSlug}`}
      />
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
      />
    </>
  );
}
