"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { restoreEntityAction } from "@/app/m/[worldSlug]/mj/journal-historique/actions";
import { formaterJourCourt } from "./journal/format";
import { useCachedGet } from "./useCachedGet";

export interface DeletedEntitySummary {
  id: string;
  name: string;
  slug: string;
  entityKind: string;
  deletedAt: string;
  /** V3.1-143 : nom de qui l'a supprimée ; `null` si inconnu (suppressions d'avant V3.1-143). */
  deletedByName: string | null;
}

/**
 * Fiches supprimées, avec un « Rétablir » par ligne (V3.1-61). Même
 * `useCachedGet` que le journal (pas de flash en rebasculant de section).
 * « Rétablir » passe par une action serveur : elle revalide l'arborescence
 * du monde, la fiche y revient sans rechargement de la page. Ici on ne
 * rafraîchit que la liste des fiches supprimées. L'auteur de la suppression
 * (V3.1-143) est posé par la base ; inconnu, la ligne dit seulement la date.
 */
export default function DeletedEntitiesPanel({ worldSlug }: { worldSlug: string }) {
  const t = useTranslations("journal.supprimees");
  const tShell = useTranslations("shell");
  const locale = useLocale();
  const { data, reload } = useCachedGet<DeletedEntitySummary[]>(`deleted-entities:${worldSlug}`, `/api/worlds/${worldSlug}/deleted-entities`);
  const entities = data ?? null;
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function typeDe(kind: string): string {
    const cle = `kindLabelsSingular.${kind}`;
    return tShell.has(cle) ? tShell(cle) : tShell("kindLabelsSingular.other");
  }

  async function restore(id: string) {
    setPendingId(id);
    setError(null);
    try {
      const result = await restoreEntityAction(worldSlug, id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      reload();
    } catch (erreur) {
      console.error("Rétablissement impossible", erreur);
      setError(t("erreur"));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-edge bg-panel-sunken p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="block-title flex-1 text-base">{t("titre")}</h2>
        {entities && entities.length > 0 && <span className="text-xs tabular-nums text-ink-muted">{entities.length}</span>}
      </div>
      {entities === null && <p className="text-xs text-ink-muted">…</p>}
      {entities && entities.length === 0 && <p className="text-xs text-ink-muted">{t("aucune")}</p>}
      {entities && entities.length > 0 && (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto text-sm">
          {entities.map((entity) => (
            <li key={entity.id} className="flex items-center justify-between gap-2 border-b border-edge/30 pb-1">
              <span className="min-w-0 text-ink">
                {entity.name || t("sansNom")}{" "}
                <span className="text-xs text-ink-muted">
                  · {typeDe(entity.entityKind)} · {entity.deletedByName
                    ? t("supprimeeLePar", { date: formaterJourCourt(entity.deletedAt, locale), nom: entity.deletedByName })
                    : t("supprimeeLe", { date: formaterJourCourt(entity.deletedAt, locale) })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => restore(entity.id)}
                disabled={pendingId === entity.id}
                className="shrink-0 rounded-full border border-edge px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
              >
                {pendingId === entity.id ? t("retablissement") : t("retablir")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
