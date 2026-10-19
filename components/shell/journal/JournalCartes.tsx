"use client";

import { useLocale, useTranslations } from "next-intl";
import { groupesParFiche } from "@/lib/ui/journalHistorique";
import { formaterQuand } from "./format";
import type { EntreeJournal } from "./types";

/** « Partie modifiée — détail » d'une ligne de carte ; le détail garde ses lignes séparées. */
function quoiDe(entree: EntreeJournal): string {
  if (entree.source === "jeu") return entree.label;
  if (entree.blockLabel === null) return entree.label;
  return entree.blockDetail ? `${entree.blockLabel} — ${entree.blockDetail}` : entree.blockLabel;
}

/**
 * Vue « Par fiche » (V3.1-61) : une carte par fiche modifiée, ses changements
 * dessous. Toucher le nom ne montre que cette fiche ; les événements de jeu
 * sans fiche se regroupent dans « Sans fiche (jeu) ».
 */
export default function JournalCartes({
  entrees,
  typeDe,
  onSeulementFiche,
}: {
  entrees: EntreeJournal[];
  typeDe: (entree: EntreeJournal) => string;
  onSeulementFiche: (slug: string) => void;
}) {
  const t = useTranslations("journal");
  const locale = useLocale();
  const cartes = groupesParFiche(entrees);

  return (
    <div className="grid items-start gap-2.5 lg:grid-cols-2">
      {cartes.map((carte) => (
        <section key={carte.slug ?? ""} className="flex flex-col gap-1 rounded-2xl border border-edge bg-panel-sunken px-3 py-2.5">
          <header className="flex items-center gap-2 text-sm font-semibold text-ink">
            {carte.slug === null ? (
              <span className="min-w-0 flex-1 truncate">{t("sansFiche")}</span>
            ) : (
              <button
                type="button"
                onClick={() => onSeulementFiche(carte.slug as string)}
                title={t("ouvrirFicheSeule", { nom: carte.nom ?? carte.slug })}
                className="min-w-0 flex-1 truncate text-left text-link-entity hover:underline"
              >
                {carte.nom ?? carte.slug}
              </button>
            )}
            {carte.slug !== null && (
              <span className="shrink-0 rounded-full border border-edge px-2 text-xs font-normal text-ink-muted">{typeDe(carte.entrees[0])}</span>
            )}
            <small className="shrink-0 text-xs font-normal text-ink-muted">{t("modifications", { n: carte.entrees.length })}</small>
          </header>
          {carte.entrees.map((entree) => (
            <div key={entree.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 border-t border-edge py-1 text-xs">
              <span className="tabular-nums text-ink-muted">{formaterQuand(entree.createdAt, locale)}</span>
              <span className="whitespace-pre-line text-ink-soft">
                <b className="font-semibold text-ink">{entree.accountName}</b> · {quoiDe(entree)}
              </span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
