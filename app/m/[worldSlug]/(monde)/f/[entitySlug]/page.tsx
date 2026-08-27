import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntityWindowData } from "@/src/server/services/entityWindow";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";
import EditEntityForm from "./EditEntityForm";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ worldSlug: string; entitySlug: string }>;
}) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const data = await getEntityWindowData(supabase, worldSlug, entitySlug);
  if (!data) notFound();

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
