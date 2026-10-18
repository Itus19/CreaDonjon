"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { SEMAINE_MAX, type ActionCalendrier } from "@/lib/ui/calendrierEdition";

const BOUTON = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-30";
const GLYPHE = "flex h-6 w-6 items-center justify-center rounded text-xs text-ink-muted transition-colors hover:text-ink disabled:opacity-30";

/**
 * La semaine en puces (V3.1-55) : › décale un jour d'un rang, × le supprime,
 * « + jour » en ajoute un ; et « le 1er jour de l'an 0 était un ‹ X › », qui
 * fait tourner `weekdayEpoch` (et décale donc toutes les grilles).
 */
export default function SemaineEnPuces({
  calendrier,
  dispatch,
}: {
  calendrier: CalendarConfigInput;
  dispatch: Dispatch<ActionCalendrier>;
}) {
  const t = useTranslations("calendrier");
  const jours = calendrier.weekdays;
  const epoque = calendrier.weekdayEpoch % jours.length;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("semaineTitre")}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {jours.map((jour, i) => (
          <li key={i} className="flex items-center gap-0.5 rounded-full border border-edge bg-panel py-0.5 pl-3 pr-1">
            <input
              value={jour.name}
              onChange={(e) => dispatch({ type: "semaineRenommer", index: i, nom: e.target.value })}
              aria-label={t("nomDuJour")}
              size={Math.max(4, jour.name.length)}
              className="bg-transparent text-sm text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => dispatch({ type: "semaineDecaler", index: i })}
              disabled={i === jours.length - 1}
              aria-label={t("decalerJour")}
              className={GLYPHE}
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "semaineSupprimer", index: i })}
              disabled={jours.length <= 1}
              aria-label={t("supprimerJour")}
              className={`${GLYPHE} hover:text-danger`}
            >
              ×
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => dispatch({ type: "semaineAjouter", nom: t("nouveauJour", { n: jours.length + 1 }) })}
            disabled={jours.length >= SEMAINE_MAX}
            className={BOUTON}
          >
            {t("ajouterJour")}
          </button>
        </li>
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span>{t("epoquePrefixe")}</span>
        <button
          type="button"
          onClick={() => dispatch({ type: "epoque", index: (epoque - 1 + jours.length) % jours.length })}
          aria-label={t("epoquePrecedent")}
          className={GLYPHE}
        >
          ‹
        </button>
        <span className="min-w-20 text-center font-semibold text-ink">{jours[epoque]?.name}</span>
        <button
          type="button"
          onClick={() => dispatch({ type: "epoque", index: (epoque + 1) % jours.length })}
          aria-label={t("epoqueSuivant")}
          className={GLYPHE}
        >
          ›
        </button>
      </div>
    </section>
  );
}
