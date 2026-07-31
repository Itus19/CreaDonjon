import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityTree, listEntities } from "@/src/server/services/entities";
import AppShell from "@/components/shell/AppShell";

export default async function WorldLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const [tree, entities] = await Promise.all([
    getEntityTree(supabase, world.id),
    listEntities(supabase, world.id),
  ]);

  return (
    <AppShell
      worldId={world.id}
      worldName={world.name}
      worldSlug={world.slug}
      tree={tree}
      entities={entities.map((e) => ({ id: e.id, name: e.name, slug: e.slug, entity_kind: e.entity_kind }))}
    >
      {children}
    </AppShell>
  );
}
