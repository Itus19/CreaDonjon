import { getLocale } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { listWorldCards } from "@/src/server/services/worlds";
import { listSelectableRulesetsForCurrentUser } from "@/src/server/services/rules";
import { isSuperadmin } from "@/src/server/services/account";
import { getOwnProfile } from "@/src/server/repos/account";
import { getAppIdentity } from "@/src/server/services/appIdentity";
import type { Locale } from "@/src/i18n/request";
import { logout } from "./login/actions";
import CreateWorldForm from "./CreateWorldForm";
import ImportWorldForm from "./ImportWorldForm";
import AdminPanel from "@/components/shell/AdminPanel";
import HomeScreen from "@/components/shell/HomeScreen";
import HomeShell from "@/components/shell/HomeShell";
import HomeProfilePanel from "@/components/shell/HomeProfilePanel";

export default async function Home() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const locale = (await getLocale()) as Locale;
  const [worlds, selectableRulesets, canUseSoloMode, profile, identite] = await Promise.all([
    user ? listWorldCards(supabase, locale, user.id) : Promise.resolve([]),
    listSelectableRulesetsForCurrentUser(supabase),
    user ? isSuperadmin(supabase, user.id) : Promise.resolve(false),
    user ? getOwnProfile(supabase, user.id) : Promise.resolve(null),
    getAppIdentity(),
  ]);
  const officialRulesets = (selectableRulesets ?? []).filter((r) => r.is_official_base);

  return (
    // Accueil en tableau de bord (V3.1-35) : trois destinations — Mondes,
    // Compte, Administration — dans le rail du joueur (grand ecran) ou la
    // barre du bas (telephone).
    //
    // `h-dvh` est conserve tel quel : ADR 0025 l'a retire des coquilles DE
    // MONDE, ou un ancetre borne resout la hauteur. Cette page est hors
    // `/m` et n'a pas cet ancetre ; le changer est un sujet a part, pas une
    // traine de ce lot.
    <div className="h-dvh overflow-hidden font-sans">
      <HomeShell
        identite={{ name: identite.name, logoKey: identite.logoKey, logoUrl: identite.logoUrl }}
        compte={
          <div className="flex flex-col gap-4">
            <HomeProfilePanel email={user?.email ?? ""} displayName={profile?.display_name ?? ""} />
            {/* Telephone seulement : a partir de 768 px la deconnexion est en
                pied de rail (HomeShell), la barre du bas n'ayant que des
                destinations. */}
            <form action={logout} className="md:hidden">
              <button className="rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:bg-panel-raised">
                Se déconnecter
              </button>
            </form>
          </div>
        }
        admin={canUseSoloMode ? <AdminPanel /> : null}
        mondes={
          <HomeScreen
            worlds={worlds}
            currentUserId={user?.id ?? ""}
            canUseSoloMode={canUseSoloMode}
            menerPartie={
              <>
                <CreateWorldForm officialRulesets={officialRulesets} canUseSoloMode={canUseSoloMode} />
                <ImportWorldForm canUseSoloMode={canUseSoloMode} />
              </>
            }
            jouerSolo={
              canUseSoloMode ? (
                <CreateWorldForm officialRulesets={officialRulesets} canUseSoloMode={canUseSoloMode} modeInitial="solo" />
              ) : null
            }
          />
        }
      />
    </div>
  );
}
