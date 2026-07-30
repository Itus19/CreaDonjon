import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntityBySlug } from "@/src/server/repos/entities";
import EditEntityForm from "./EditEntityForm";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ worldId: string; entitySlug: string }>;
}) {
  const { worldId, entitySlug } = await params;
  const supabase = await createClient();
  const entity = await getEntityBySlug(supabase, worldId, entitySlug);
  if (!entity) notFound();

  return <EditEntityForm worldId={worldId} entity={entity} />;
}
