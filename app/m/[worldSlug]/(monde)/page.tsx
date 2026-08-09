import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listEntities } from "@/src/server/services/entities";
import { listWorldPlayerCharacters } from "@/src/server/services/worldPlayerCharacters";
import EmptyState from "@/components/shell/EmptyState";
import type { Locale } from "@/src/i18n/request";
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

  const locale = (await getLocale()) as Locale;
  const [entities, playerCharacters] = await Promise.all([
    listEntities(supabase, world.id),
    listWorldPlayerCharacters(supabase, world.id, locale),
  ]);
  const t = await getTranslations("monde");
  const tShell = await getTranslations("shell");

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="entity-title font-narrative text-2xl font-semibold text-accent">{world.name}</h1>
        <p className="mt-1 text-sm font-medium text-ink-muted">{t("nouvellesAventures")}</p>
      </div>

      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          {t("personnagesJoueurs")}
        </span>
        {playerCharacters.length === 0 ? (
          <p className="mt-1 text-sm text-ink-muted">{t("aucunPj")}</p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1">
            {playerCharacters.map((pc) => (
              <li key={pc.entityId}>
                <Link
                  href={`/m/${worldSlug}/f/${pc.entitySlug}`}
                  className="text-sm text-link-entity hover:underline"
                >
                  {pc.entityName}
                </Link>
                {(pc.speciesLabel || pc.classesLabel) && (
                  <span className="text-sm text-ink-muted">
                    {" — "}
                    {[pc.speciesLabel, pc.classesLabel].filter(Boolean).join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

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
    </div>
  );
}
