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
    .select("id, name, default_ruleset_id")
    .eq("id", id)
    .single();

  if (!world) {
    notFound();
  }

  const [{ data: entities }, { data: rulesets }] = await Promise.all([
    supabase
      .from("entities")
      .select("id, name, entity_kind, summary")
      .eq("world_id", id)
      .order("name"),
    supabase.from("rulesets").select("id, name").order("name"),
  ]);

  return (
    <WorldDesktop
      worldId={world.id}
      worldName={world.name}
      entities={entities ?? []}
      rulesets={rulesets ?? []}
      defaultRulesetId={world.default_ruleset_id}
    />
  );
}
