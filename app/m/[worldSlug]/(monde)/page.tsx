import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { listEntities } from "@/src/server/services/entities";
import { listShareLinks } from "@/src/server/services/shareLinks";
import { listCampaigns } from "@/src/server/services/campaigns";
import EmptyState from "@/components/shell/EmptyState";
import ShareLinkPanel from "@/components/shell/ShareLinkPanel";
import CampaignsPanel from "@/components/shell/CampaignsPanel";
import { createBlankEntityAction } from "../actions";

export default async function WorldHomePage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const [entities, shareLinks, campaigns, defaultRulesetId] = await Promise.all([
    listEntities(supabase, world.id),
    listShareLinks(supabase, world.id),
    listCampaigns(supabase, world.id),
    getWorldDefaultRulesetId(supabase, world.id),
  ]);
  const t = await getTranslations("monde");
  const tShell = await getTranslations("shell");

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="entity-title font-narrative text-2xl font-semibold text-accent">{world.name}</h1>

      {entities.length === 0 ? (
        <EmptyState
          title={t("videTitre")}
          description={t("videDescription")}
          action={
            <form action={createBlankEntityAction}>
              <input type="hidden" name="worldId" value={world.id} />
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <button
                type="submit"
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
              >
                {tShell("nouvelleEntite")}
              </button>
            </form>
          }
        />
      ) : (
        <p className="text-sm text-ink-muted">{t("choisirEntite")}</p>
      )}

      <CampaignsPanel
        worldSlug={worldSlug}
        defaultRulesetId={defaultRulesetId}
        initialCampaigns={campaigns}
        worldEntities={entities.filter((e) => e.entity_kind === "character").map((e) => ({ id: e.id, name: e.name }))}
      />

      <ShareLinkPanel worldId={world.id} worldSlug={worldSlug} links={shareLinks} />
    </div>
  );
}
