import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
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

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = (await getLocale()) as Locale;
  const [worlds, selectableRulesets, canUseSoloMode, profile] = await Promise.all([
    user ? listWorldCards(supabase, locale, user.id) : Promise.resolve([]),
    listSelectableRulesetsForCurrentUser(supabase),
    user ? isSuperadmin(supabase, user.id) : Promise.resolve(false),
    user ? getOwnProfile(supabase, user.id) : Promise.resolve(null),
  ]);
  const officialRulesets = (selectableRulesets ?? []).filter((r) => r.is_official_base);

  return (
    <div className="flex flex-1 justify-center font-sans">
      <main className="flex w-full max-w-[1600px] flex-col gap-6 py-16 px-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-wide text-accent">
            CreaDonjon
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink-muted">{user?.email}</span>
            <form action={logout}>
              <button className="rounded-full border border-edge px-3 py-1 text-ink transition-colors hover:bg-panel-raised">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        {canUseSoloMode && <AdminPanel />}

        {/* Ecran d'accueil en trois colonnes (retour utilisateur) : profil,
            mondes/campagnes, detail du monde selectionne — remplace
            l'ancienne colonne unique (V2-M5). */}
        <HomeScreen
          worlds={worlds}
          currentUserId={user?.id ?? ""}
          email={user?.email ?? ""}
          displayName={profile?.display_name ?? ""}
          createTools={
            <div className="flex flex-wrap items-center gap-2">
              <CreateWorldForm officialRulesets={officialRulesets} canUseSoloMode={canUseSoloMode} />
              <ImportWorldForm canUseSoloMode={canUseSoloMode} />
            </div>
          }
        />
      </main>
    </div>
  );
}
