import Link from "next/link";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { listWorldCards } from "@/src/server/services/worlds";
import { listSelectableRulesetsForCurrentUser } from "@/src/server/services/rules";
import { isSuperadmin } from "@/src/server/services/account";
import type { Locale } from "@/src/i18n/request";
import { logout } from "./login/actions";
import CreateWorldForm from "./CreateWorldForm";
import ImportWorldForm from "./ImportWorldForm";
import WorldCardActions from "./WorldCardActions";
import AdminPanel from "@/components/shell/AdminPanel";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = (await getLocale()) as Locale;
  const [worlds, selectableRulesets, canUseSoloMode] = await Promise.all([
    user ? listWorldCards(supabase, locale, user.id) : Promise.resolve([]),
    listSelectableRulesetsForCurrentUser(supabase),
    user ? isSuperadmin(supabase, user.id) : Promise.resolve(false),
  ]);
  const officialRulesets = (selectableRulesets ?? []).filter((r) => r.is_official_base);

  return (
    <div className="flex flex-1 justify-center font-sans">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-16 px-8">
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

        <div className="flex flex-wrap items-center gap-2">
          <CreateWorldForm officialRulesets={officialRulesets} canUseSoloMode={canUseSoloMode} />
          <ImportWorldForm canUseSoloMode={canUseSoloMode} />
        </div>

        <ul className="flex flex-col gap-2">
          {worlds.map((world) => {
            // V2-M5, retour utilisateur 30 août : le rôle réel dans CE
            // monde, jamais un rôle global de compte — un même compte peut
            // être MJ ici et joueur ailleurs (voir Préalable, Lot M).
            const roleLabel = world.myRole === "player" ? "Joueur" : world.mode === "solo" ? "Solo" : "MJ";
            const href =
              world.myRole === "player" && world.myCharacter
                ? `/m/${world.slug}/f/${world.myCharacter.entitySlug}`
                : `/m/${world.slug}`;
            return (
              <li key={world.id} className="rounded-lg border border-edge bg-panel p-4 transition-colors hover:bg-panel-raised">
                <Link href={href} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink">{world.name}</p>
                    <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                      {roleLabel}
                    </span>
                  </div>
                  {world.campaignName && (
                    <p className="text-xs text-ink-muted">Campagne : {world.campaignName}</p>
                  )}
                  {world.myRole === "player" ? (
                    <p className="text-sm text-ink-muted">
                      {world.myCharacter ? world.myCharacter.name : "Personnage introuvable"}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-ink-muted">
                        {world.rulesetName ?? "Aucun ruleset"} · Modifié le {formatDate(world.lastModified)}
                      </p>
                      {world.players.length > 0 ? (
                        <ul className="mt-0.5 flex flex-col">
                          {world.players.map((pc) => (
                            <li key={pc.entityId} className="text-sm text-ink-muted">
                              {pc.name}
                              {(pc.speciesLabel || pc.classesLabel) && (
                                <> — {[pc.speciesLabel, pc.classesLabel].filter(Boolean).join(" · ")}</>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-ink-muted">Aucun joueur</p>
                      )}
                    </>
                  )}
                </Link>
                {world.myRole !== "player" && (
                  <WorldCardActions
                    worldId={world.id}
                    worldSlug={world.slug}
                    worldName={world.name}
                    campaignId={world.campaignId}
                    campaignName={world.campaignName}
                    isOwner={world.ownerId === user?.id}
                  />
                )}
              </li>
            );
          })}
          {worlds.length === 0 && (
            <p className="text-ink-muted">Aucun monde pour l&apos;instant.</p>
          )}
        </ul>
      </main>
    </div>
  );
}
