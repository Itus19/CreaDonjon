import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { isSuperadmin } from "@/src/server/services/account";
import { listAccountsForAdmin } from "@/src/server/services/adminAccounts";
import { listAllInvitesForAdmin } from "@/src/server/services/campaignInvites";
import { getAppIdentity } from "@/src/server/services/appIdentity";
import { countPlayerTitleTiers } from "@/src/server/repos/playerTitleTiers";
import HomeShell from "@/components/shell/HomeShell";
import PageAdministration from "@/components/shell/PageAdministration";

/**
 * Administration (V3.1-87) : le tableau de bord du superadmin, une ROUTE
 * habillée par la coquille de l'accueil. Le droit se vérifie ici, avant tout
 * rendu : tout autre compte reçoit une 404 (la page n'existe pas pour lui),
 * jamais un écran vide. Tout arrive avec la page (docs/CABLAGE.md, C1) ; les
 * gestes passent ensuite par les routes `/api/admin/*`, qui revérifient.
 */
export default async function AdministrationPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user || !(await isSuperadmin(supabase, user.id))) notFound();

  const [comptes, liens, identite, nombreTitres] = await Promise.all([
    listAccountsForAdmin(supabase, user.id),
    listAllInvitesForAdmin(supabase),
    getAppIdentity(),
    countPlayerTitleTiers(supabase),
  ]);
  if (comptes === null) notFound();

  return (
    <div className="h-dvh overflow-hidden font-sans">
      <HomeShell
        identite={{ name: identite.name, logoKey: identite.logoKey, logoUrl: identite.logoUrl }}
        page="admin"
        avecAdmin
        admin={
          <PageAdministration
            comptesInitiaux={comptes}
            liensInitiaux={liens}
            identite={identite}
            nombreTitres={nombreTitres}
          />
        }
      />
    </div>
  );
}
