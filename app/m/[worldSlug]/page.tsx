import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listEntities } from "@/src/server/services/entities";
import { listShareLinks } from "@/src/server/services/shareLinks";
import EmptyState from "@/components/shell/EmptyState";
import ShareLinkPanel from "@/components/shell/ShareLinkPanel";
import { createBlankEntityAction } from "./actions";

export default async function WorldHomePage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const [entities, shareLinks] = await Promise.all([
    listEntities(supabase, world.id),
    listShareLinks(supabase, world.id),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="entity-title font-narrative text-2xl font-semibold text-accent">{world.name}</h1>

      {entities.length === 0 ? (
        <EmptyState
          title="Ce monde est encore vide"
          description="Créez votre première entité — un personnage, un lieu, une faction — pour commencer à le peupler."
          action={
            <form action={createBlankEntityAction}>
              <input type="hidden" name="worldId" value={world.id} />
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <button
                type="submit"
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
              >
                + Nouvelle entité
              </button>
            </form>
          }
        />
      ) : (
        <p className="text-sm text-ink-muted">
          Choisissez une entité dans la barre latérale, ou créez-en une nouvelle depuis le bouton en bas.
        </p>
      )}

      <ShareLinkPanel worldId={world.id} worldSlug={worldSlug} links={shareLinks} />
    </div>
  );
}
