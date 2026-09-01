import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityTree, listEntities } from "@/src/server/services/entities";
import MondeShell from "@/components/shell/MondeShell";

export default async function MondeLayout({
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
  const user = await getAuthUser(supabase);

  const [tree, entities] = await Promise.all([
    getEntityTree(supabase, world.id, user?.id ?? null),
    listEntities(supabase, world.id, user?.id ?? null),
  ]);

  return (
    <MondeShell
      worldId={world.id}
      worldSlug={world.slug}
      tree={tree}
      entities={entities.map((e) => ({ id: e.id, name: e.name, slug: e.slug, entity_kind: e.entity_kind }))}
    >
      {children}
    </MondeShell>
  );
}
