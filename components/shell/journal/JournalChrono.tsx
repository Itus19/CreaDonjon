"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cleDuJour, groupesChronologiques, initialeDe, PERSONNE_IA, type TriJournal } from "@/lib/ui/journalHistorique";
import { formaterHeure, formaterJourLong, formaterQuand } from "./format";
import type { EntreeJournal } from "./types";

/**
 * Vue « Chronologique » (V3.1-61) : la liste groupée selon le tri (jour,
 * personne, fiche). Toucher une ligne qui a un détail le déplie ; le nom de
 * la fiche, lui, ne montre que cette fiche.
 */
export default function JournalChrono({
  entrees,
  tri,
  typeDe,
  ouvertes,
  onBasculer,
  onSeulementFiche,
}: {
  entrees: EntreeJournal[];
  tri: TriJournal;
  typeDe: (entree: EntreeJournal) => string;
  ouvertes: ReadonlySet<number>;
  onBasculer: (id: number) => void;
  onSeulementFiche: (slug: string) => void;
}) {
  const t = useTranslations("journal");
  const locale = useLocale();
  const groupes = groupesChronologiques(entrees, tri);
  // Jours « Aujourd'hui » et « Hier » fixés au montage (un rendu reste pur).
  const [{ aujourdhui, hier }] = useState(() => {
    const maintenant = new Date();
    const veille = new Date(maintenant);
    veille.setDate(veille.getDate() - 1);
    return { aujourdhui: cleDuJour(maintenant.toISOString()), hier: cleDuJour(veille.toISOString()) };
  });

  function libelleGroupe(genre: string, cle: string, premiere: EntreeJournal): string {
    if (genre === "personne") return cle;
    if (genre === "fiche") return cle === "" ? t("sansFiche") : (premiere.entityName ?? cle);
    const jour = formaterJourLong(premiere.createdAt, locale);
    if (cle === aujourdhui) return `${t("aujourdhui")} · ${jour}`;
    if (cle === hier) return `${t("hier")} · ${jour}`;
    return jour;
  }

  return (
    <div className="flex flex-col">
      {groupes.map((groupe) => (
        <section key={`${groupe.genre}:${groupe.cle}`} className="flex flex-col">
          <h3 className="flex items-center gap-2 px-0.5 pb-0.5 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {libelleGroupe(groupe.genre, groupe.cle, groupe.entrees[0])}
            <span className="font-normal normal-case tracking-normal">{t("modifications", { n: groupe.entrees.length })}</span>
          </h3>
          {groupe.entrees.map((entree) => {
            const ia = entree.accountName === PERSONNE_IA;
            const aDetail = entree.source === "wiki" && entree.blockDetail !== null;
            const ouverte = aDetail && ouvertes.has(entree.id);
            const quand = tri === "recent" || tri === "ancien" ? formaterHeure(entree.createdAt, locale) : formaterQuand(entree.createdAt, locale);
            const verbe =
              entree.source === "jeu"
                ? entree.entitySlug !== null
                  ? t("verbes.joueAvec")
                  : t("verbes.joue")
                : entree.blockLabel !== null
                  ? t("verbes.modifieDans", { partie: entree.blockLabel })
                  : t("verbes.modifie");
            const premiereLigne =
              entree.source === "jeu"
                ? entree.label
                : [entree.blockDetail?.split("\n")[0], entree.revisionNumber !== null ? t("revision", { n: entree.revisionNumber }) : null]
                    .filter((morceau): morceau is string => !!morceau)
                    .join(" · ");
            return (
              <div
                key={entree.id}
                onClick={aDetail ? () => onBasculer(entree.id) : undefined}
                className={`grid ${tri === "recent" || tri === "ancien" ? "grid-cols-[2.75rem_1.5rem_minmax(0,1fr)_auto]" : "grid-cols-[6rem_1.5rem_minmax(0,1fr)_auto]"} items-start gap-2.5 rounded-lg border-t border-edge px-1 py-1.5 ${
                  aDetail ? "cursor-pointer hover:bg-panel-raised/40" : ""
                }`}
              >
                <span className="pt-0.5 text-xs tabular-nums text-ink-muted">{quand}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 items-center justify-center rounded-full border bg-panel-raised text-xs font-semibold ${
                    ia ? "border-accent/60 text-accent" : "border-edge-strong text-ink"
                  }`}
                >
                  {initialeDe(entree.accountName)}
                </span>
                <span className="min-w-0 text-sm leading-snug text-ink">
                  <b className="font-semibold">{entree.accountName}</b> {verbe}
                  {entree.entitySlug !== null && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeulementFiche(entree.entitySlug as string);
                        }}
                        title={t("ouvrirFicheSeule", { nom: entree.entityName ?? entree.entitySlug })}
                        className="text-link-entity hover:underline"
                      >
                        {entree.entityName ?? entree.entitySlug}
                      </button>{" "}
                      <span className="rounded-full border border-edge px-1.5 text-xs text-ink-muted">{typeDe(entree)}</span>
                    </>
                  )}
                  {premiereLigne !== "" &&
                    (aDetail ? (
                      <button type="button" aria-expanded={ouverte} className="block w-full text-left text-xs text-ink-muted">
                        {premiereLigne}
                      </button>
                    ) : (
                      <span className="block text-xs text-ink-muted">{premiereLigne}</span>
                    ))}
                  {ouverte && (
                    <span className="mt-1 block whitespace-pre-line rounded-lg border border-edge bg-panel-sunken px-2 py-1.5 text-xs tabular-nums text-ink-soft">
                      {entree.blockDetail}
                    </span>
                  )}
                </span>
                <span
                  className={`rounded-full border px-2 text-xs ${
                    entree.source === "wiki" ? "border-accent/50 text-accent" : "border-edge text-ink-muted"
                  }`}
                >
                  {t(`sources.${entree.source}`)}
                </span>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
