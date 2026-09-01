import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldDefaultRulesetId } from "@/src/server/repos/worlds";
import { listEntities } from "@/src/server/services/entities";
import { listCampaigns } from "@/src/server/services/campaigns";
import { isSuperadmin } from "@/src/server/services/account";
import { isWorldAdmin } from "@/src/server/services/permissions";
import CampaignsPanel from "@/components/shell/CampaignsPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Gestion de campagne (V2-M7 suite, retour utilisateur : "separe les deux
 * outils Journal et Campagne") — permissions et attribution uniquement,
 * le journal d'historique vit desormais dans son propre outil
 * (`journal-historique/page.tsx`).
 */
export default async function MjGestionCampagnePage({
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

  const [entities, campaigns, defaultRulesetId, superadmin, gm] = await Promise.all([
    listEntities(supabase, world.id, user?.id ?? null),
    listCampaigns(supabase, world.id),
    getWorldDefaultRulesetId(supabase, world.id),
    user ? isSuperadmin(supabase, user.id) : Promise.resolve(false),
    user ? isWorldAdmin(supabase, { worldId: world.id, userId: user.id }) : Promise.resolve(false),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "gestion-campagne" }} name="Gestion de campagne" badge="" homeHref={`/m/${worldSlug}/mj`} />
      <CampaignsPanel
        worldSlug={worldSlug}
        defaultRulesetId={defaultRulesetId}
        initialCampaigns={campaigns}
        worldEntities={entities.filter((e) => e.entity_kind === "character").map((e) => ({ id: e.id, name: e.name }))}
        // V2-M9 (Lot M) : "Octrois d'edition" doit pouvoir porter sur
        // N'IMPORTE QUELLE fiche du monde (lieu, faction, objet...), pas
        // seulement les personnages — distinct de `worldEntities` ci-dessus,
        // qui reste reserve a "Personnages attribues" (assigner un PJ/PNJ
        // n'a de sens que pour une fiche de type personnage). `notes` deja
        // exclu par `listEntities` (fiches privees).
        grantableEntities={entities.map((e) => ({ id: e.id, name: e.name }))}
        canUseSoloMode={superadmin}
        canManage={gm}
      />
    </div>
  );
}
