"use client";

import { useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { daysBetween, monthGrid } from "@/src/core/calendar/navigation";
import { weekdayNameForDate } from "@/src/core/calendar/weekday";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { JOURS_PAR_MOIS_MAX, MOIS_MAX, type ActionCalendrier } from "@/lib/ui/calendrierEdition";

const BOUTON = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-30";
const PETIT = "flex h-7 w-7 items-center justify-center rounded border border-edge text-sm text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-30";

/**
 * Le réglage d'un mois (V3.1-55) : nom, durée en − / + (1 à 60), position
 * ↑ ↓, sa grille (‹ › change de mois), « + Ajouter un mois après », « Supprimer
 * ce mois ». Toucher un jour de la grille le sélectionne et propose
 * « En faire aujourd'hui ». À monter avec `key={index}` : la sélection d'un
 * jour repart de zéro quand on change de mois.
 */
export default function ReglageMois({
  calendrier,
  index,
  annee,
  dispatch,
  onChoisir,
}: {
  calendrier: CalendarConfigInput;
  index: number;
  annee: number;
  dispatch: Dispatch<ActionCalendrier>;
  onChoisir: (index: number) => void;
}) {
  const t = useTranslations("calendrier");
  const [jourChoisi, setJourChoisi] = useState<number | null>(null);
  const total = calendrier.months.length;
  const mois = calendrier.months[index];
  const grille = monthGrid(annee, index + 1, calendrier);
  const courant = calendrier.currentDate;
  const aujourdhui = courant && courant.month !== null && courant.day !== null ? { year: courant.year, month: courant.month, day: courant.day } : null;

  const choisi = jourChoisi !== null && jourChoisi <= grille.days ? { year: annee, month: index + 1, day: jourChoisi } : null;
  let phrase = "";
  if (choisi) {
    const semaine = weekdayNameForDate(choisi, calendrier);
    const date = semaine
      ? t("jourChoisi", { jourSemaine: semaine, jour: choisi.day, mois: mois.name, annee })
      : t("jourChoisiSansSemaine", { jour: choisi.day, mois: mois.name, annee });
    if (aujourdhui) {
      const ecart = daysBetween(aujourdhui, choisi, calendrier);
      const relatif = ecart === 0 ? t("cestAujourdhui") : ecart > 0 ? t("dansJours", { n: ecart }) : t("ilYaJours", { n: -ecart });
      phrase = `${date} — ${relatif}`;
    } else {
      phrase = date;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        value={mois.name}
        onChange={(e) => dispatch({ type: "moisRenommer", index, nom: e.target.value })}
        aria-label={t("nomDuMois")}
        placeholder={t("nomDuMois")}
        className="rounded border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none focus:border-accent"
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => dispatch({ type: "moisDuree", index, jours: mois.days - 1 })}
            disabled={mois.days <= 1}
            aria-label={t("unJourDeMoins")}
            className={PETIT}
          >
            −
          </button>
          <span className="min-w-16 text-center text-sm text-ink">{t("dureeJours", { n: mois.days })}</span>
          <button
            type="button"
            onClick={() => dispatch({ type: "moisDuree", index, jours: mois.days + 1 })}
            disabled={mois.days >= JOURS_PAR_MOIS_MAX}
            aria-label={t("unJourDePlus")}
            className={PETIT}
          >
            +
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-ink-muted">{t("position")}</span>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "moisDeplacer", index, sens: -1 });
              onChoisir(index - 1);
            }}
            disabled={index === 0}
            aria-label={t("monter")}
            className={PETIT}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "moisDeplacer", index, sens: 1 });
              onChoisir(index + 1);
            }}
            disabled={index === total - 1}
            aria-label={t("descendre")}
            className={PETIT}
          >
            ↓
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => onChoisir((index - 1 + total) % total)} aria-label={t("moisPrecedent")} className={PETIT}>
            ‹
          </button>
          <span className="truncate text-sm font-medium text-ink">
            {mois.name} {annee}
          </span>
          <button type="button" onClick={() => onChoisir((index + 1) % total)} aria-label={t("moisSuivant")} className={PETIT}>
            ›
          </button>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${grille.weekLength}, minmax(0, 1fr))` }}>
          {calendrier.weekdays.map((jour, i) => (
            <span key={`e${i}`} className="truncate text-center text-xs text-ink-muted" title={jour.name}>
              {jour.name.slice(0, 2)}
            </span>
          ))}
          {Array.from({ length: grille.offset }, (_, i) => (
            <span key={`v${i}`} />
          ))}
          {Array.from({ length: grille.days }, (_, i) => {
            const jour = i + 1;
            const estAujourdhui = aujourdhui?.year === annee && aujourdhui.month === index + 1 && aujourdhui.day === jour;
            return (
              <button
                key={jour}
                type="button"
                onClick={() => setJourChoisi(jour)}
                aria-pressed={jourChoisi === jour}
                className={`flex h-7 items-center justify-center rounded text-xs transition-colors ${
                  estAujourdhui ? "bg-accent font-semibold text-accent-ink" : "text-ink hover:bg-panel-raised"
                } ${jourChoisi === jour ? "ring-1 ring-accent" : ""}`}
              >
                {jour}
              </button>
            );
          })}
        </div>
        {choisi && (
          <div className="flex flex-col items-start gap-1.5">
            <p className="text-xs text-ink-muted">{phrase}</p>
            <button
              type="button"
              onClick={() => dispatch({ type: "jourRegler", date: choisi })}
              className="rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-panel-raised"
            >
              {t("enFaireAujourdhui")}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "moisAjouterApres", index, nom: t("nouveauMois", { n: total + 1 }) });
            onChoisir(index + 1);
          }}
          disabled={total >= MOIS_MAX}
          className={BOUTON}
        >
          {t("ajouterMoisApres")}
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "moisSupprimer", index });
            onChoisir(Math.min(index, total - 2));
          }}
          disabled={total <= 1}
          className="rounded-full border border-edge px-3 py-1 text-xs text-danger transition-colors hover:bg-panel-raised disabled:opacity-30"
        >
          {t("supprimerMois")}
        </button>
      </div>
    </div>
  );
}
