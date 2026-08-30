import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { listEntities } from "@/src/server/services/entities";
import { listCampaigns } from "@/src/server/services/campaigns";
import { isSuperadmin } from "@/src/server/services/account";
import CampaignsPanel from "@/components/shell/CampaignsPanel";

export default async function MjCampagnesPage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [entities, campaigns, defaultRulesetId, superadmin] = await Promise.all([
    listEntities(supabase, world.id),
    listCampaigns(supabase, world.id),
    getWorldDefaultRulesetId(supabase, world.id),
    user ? isSuperadmin(supabase, user.id) : Promise.resolve(false),
  ]);

  return (
    <CampaignsPanel
      worldSlug={worldSlug}
      defaultRulesetId={defaultRulesetId}
      initialCampaigns={campaigns}
      worldEntities={entities.filter((e) => e.entity_kind === "character").map((e) => ({ id: e.id, name: e.name }))}
      canUseSoloMode={superadmin}
    />
  );
}
