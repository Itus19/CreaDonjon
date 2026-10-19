"use client";

import { useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { dayOfYearNumber, yearInEra } from "@/src/core/calendar/navigation";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { yearLength } from "@/src/core/calendar/sortKey";
import { weekdayNameForDate } from "@/src/core/calendar/weekday";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { libellePas, type ActionCalendrier } from "@/lib/ui/calendrierEdition";

const BOUTON = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised";
const CHAMP = "w-20 rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent";

/**
 * Le jour actuel (V3.1-55) : jour de la semaine, date, ère, rang dans l'année,
 * pas en avant et en arrière, et « Changer la date ». Aucun calcul de date ici :
 * tout vient de `src/core/calendar/navigation`.
 */
export default function JourActuel({
  calendrier,
  dispatch,
}: {
  calendrier: CalendarConfigInput;
  dispatch: Dispatch<ActionCalendrier>;
}) {
  const t = useTranslations("calendrier");
  const [saisie, setSaisie] = useState(false);
  const date = calendrier.currentDate;

  if (!date || date.month === null || date.day === null) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-edge bg-panel p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("jourActuelTitre")}</span>
        <p className="text-xs text-ink-muted">{t("aucunJourActuel")}</p>
        <button type="button" onClick={() => dispatch({ type: "jourInitialiser" })} className={BOUTON}>
          {t("reglerJourActuel")}
        </button>
      </div>
    );
  }

  const complete = { year: date.year, month: date.month, day: date.day };
  const jourSemaine = weekdayNameForDate(date, calendrier);
  const ere = yearInEra(date.year, calendrier);
  const pas = libellePas(calendrier.weekdays.length);
  const nomMois = calendrier.months[date.month - 1]?.name ?? "";

  function regler(patch: Partial<typeof complete>) {
    dispatch({ type: "jourRegler", date: { ...complete, ...patch } });
  }
  function nombre(valeur: string): number | null {
    const n = Number(valeur);
    return valeur.trim() !== "" && Number.isFinite(n) ? Math.round(n) : null;
  }
  function changerMois(sens: -1 | 1) {
    const total = calendrier.months.length;
    regler({ month: ((complete.month - 1 + sens + total) % total) + 1 });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-edge bg-panel p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("jourActuelTitre")}</span>
      <div>
        {jourSemaine && <p className="font-display text-lg font-bold leading-tight text-ink">{jourSemaine}</p>}
        <p className="text-sm text-ink">{formatGameDate(date, calendrier)}</p>
        <p className="text-xs text-ink-muted">
          {ere ? t("ereEtAn", { ere: ere.name, n: ere.year }) : t("avantPremiereEre")}
          {" · "}
          {t("jourSurTotal", { jour: dayOfYearNumber(complete, calendrier), total: yearLength(calendrier) })}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => dispatch({ type: "jourDecaler", n: -1 })} className={BOUTON}>
          {t("veille")}
        </button>
        <button type="button" onClick={() => dispatch({ type: "jourDecaler", n: 1 })} className={BOUTON}>
          {t("lendemain")}
        </button>
        <button type="button" onClick={() => dispatch({ type: "jourDecaler", n: pas.n })} className={BOUTON}>
          {t(pas.cle, { n: pas.n })}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setSaisie((v) => !v)}
        aria-expanded={saisie}
        className={`${BOUTON} self-start ${saisie ? "border-accent text-accent" : ""}`}
      >
        {saisie ? t("fermerDate") : t("changerDate")}
      </button>
      <button type="button" onClick={() => dispatch({ type: "jourEffacer" })} className={`${BOUTON} self-start text-ink-muted`}>
        {t("jourNonRegle")}
      </button>
      {saisie && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
            {t("champJour")}
            <input
              type="number"
              value={complete.day}
              onChange={(e) => {
                const n = nombre(e.target.value);
                if (n !== null) regler({ day: n });
              }}
              className={CHAMP}
            />
          </label>
          <div className="flex flex-col gap-0.5 text-xs text-ink-muted">
            {t("champMois")}
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => changerMois(-1)} aria-label={t("moisPrecedent")} className={BOUTON}>
                ‹
              </button>
              <span className="min-w-24 text-center text-sm text-ink">{nomMois}</span>
              <button type="button" onClick={() => changerMois(1)} aria-label={t("moisSuivant")} className={BOUTON}>
                ›
              </button>
            </div>
          </div>
          <label className="flex flex-col gap-0.5 text-xs text-ink-muted">
            {t("champAn")}
            <input
              type="number"
              value={complete.year}
              onChange={(e) => {
                const n = nombre(e.target.value);
                if (n !== null) regler({ year: n });
              }}
              className={CHAMP}
            />
          </label>
        </div>
      )}
    </div>
  );
}
