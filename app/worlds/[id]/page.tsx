import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorldDesktop from "@/components/desktop/WorldDesktop";

export default async function WorldPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: world } = await supabase
    .from("worlds")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!world) {
    notFound();
  }

  const { data: entities } = await supabase
    .from("entities")
    .select("id, name, entity_kind, summary")
    .eq("world_id", id)
    .order("name");

  return <WorldDesktop worldId={world.id} worldName={world.name} entities={entities ?? []} />;
}
