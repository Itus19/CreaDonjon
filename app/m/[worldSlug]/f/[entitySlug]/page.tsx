import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityBySlug, listEntitiesForWorld } from "@/src/server/repos/entities";
import { listVisibleBlocks } from "@/src/server/services/blocks";
import { listVisibleRelations } from "@/src/server/services/relations";
import EditEntityForm from "./EditEntityForm";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ worldSlug: string; entitySlug: string }>;
}) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const entity = await getEntityBySlug(supabase, world.id, entitySlug);
  if (!entity) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const [blocks, relations, allEntities] = await Promise.all([
    listVisibleBlocks(supabase, world.id, entity.id, user.id),
    listVisibleRelations(supabase, world.id, entity.id, user.id),
    listEntitiesForWorld(supabase, world.id),
  ]);

  const otherEntities = allEntities
    .filter((e) => e.id !== entity.id)
    .map((e) => ({ id: e.id, name: e.name, slug: e.slug, entity_kind: e.entity_kind }));

  return (
    <EditEntityForm
      entity={entity}
      worldSlug={worldSlug}
      initialBlocks={blocks}
      initialRelations={relations}
      otherEntities={otherEntities}
    />
  );
}
