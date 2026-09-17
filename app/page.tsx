import { getLocale } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { listWorldCards } from "@/src/server/services/worlds";
import { listSelectableRulesetsForCurrentUser } from "@/src/server/services/rules";
import { isSuperadmin } from "@/src/server/services/account";
import { getOwnProfile } from "@/src/server/repos/account";
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
  const [worlds, selectableRulesets, canUseSoloMode, profile] = await Promise.all([
    user ? listWorldCards(supabase, locale, user.id) : Promise.resolve([]),
    listSelectableRulesetsForCurrentUser(supabase),
    user ? isSuperadmin(supabase, user.id) : Promise.resolve(false),
    user ? getOwnProfile(supabase, user.id) : Promise.resolve(null),
  ]);
  const officialRulesets = (selectableRulesets ?? []).filter((r) => r.is_official_base);

  return (
    // Ecran d'accueil en rail de sections (V2.1-24, lot 2) : trois
    // destinations — Mondes, Compte, Administration — au lieu des trois
    // colonnes de V2-M7c, ou "mon compte" et "l'administration de tous les
    // mondes" partageaient une colonne sans avoir de rapport, la seconde
    // ecrasant la premiere.
    //
    // L'en-tete a disparu : le titre, l'e-mail et la deconnexion vivent
    // desormais dans le haut et le pied du rail, comme `AppShell.tsx` a
    // cesse de rendre le sien pour la coquille joueur.
    //
    // `h-dvh` est conserve tel quel : ADR 0025 l'a retire des coquilles DE
    // MONDE, ou un ancetre borne resout la hauteur. Cette page est hors
    // `/m` et n'a pas cet ancetre ; le changer est un sujet a part, pas une
    // traine de ce lot.
    <div className="h-dvh overflow-hidden font-sans">
      <HomeShell
        compte={
          <div className="flex flex-col gap-4">
            <HomeProfilePanel email={user?.email ?? ""} displayName={profile?.display_name ?? ""} />
            {/* La deconnexion vit ici et non dans le rail : en pied de rail
                elle aurait ete `md:` comme celui de la coquille joueur, donc
                absente sous 768 px, alors que l'ancienne barre du haut la
                montrait a toutes les largeurs. */}
            <form action={logout}>
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
            createTools={
              <div className="flex flex-wrap items-center gap-2">
                <CreateWorldForm officialRulesets={officialRulesets} canUseSoloMode={canUseSoloMode} />
                <ImportWorldForm canUseSoloMode={canUseSoloMode} />
              </div>
            }
          />
        }
      />
    </div>
  );
}
