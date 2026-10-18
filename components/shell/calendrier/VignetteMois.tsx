"use client";

import { useTranslations } from "next-intl";
import { monthGrid } from "@/src/core/calendar/navigation";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

/**
 * Un mois en vignette (V3.1-55) : nom, durée, mini-grille de l'an actuel
 * (une case par jour, sans chiffre : à cette taille un chiffre serait sous
 * `text-xs`), le jour actuel allumé. Le mois actuel est bordé d'accent.
 */
export default function VignetteMois({
  calendrier,
  index,
  annee,
  selectionne,
  onChoisir,
}: {
  calendrier: CalendarConfigInput;
  index: number;
  annee: number;
  selectionne: boolean;
  onChoisir: () => void;
}) {
  const t = useTranslations("calendrier");
  const mois = calendrier.months[index];
  const grille = monthGrid(annee, index + 1, calendrier);
  const courant = calendrier.currentDate;
  const estMoisActuel = courant?.month === index + 1;

  return (
    <button
      type="button"
      onClick={onChoisir}
      aria-pressed={selectionne}
      className={`flex flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors hover:bg-panel-raised ${
        estMoisActuel ? "border-accent" : "border-edge"
      } ${selectionne ? "bg-panel-raised" : "bg-panel"}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-ink">{mois.name}</span>
        <span className="shrink-0 text-xs text-ink-muted">{t("dureeJours", { n: mois.days })}</span>
      </span>
      <span
        aria-hidden="true"
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${grille.weekLength}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: grille.offset }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: grille.days }, (_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-[2px] ${
              estMoisActuel && courant?.day === i + 1 ? "bg-accent" : "bg-edge"
            }`}
          />
        ))}
      </span>
    </button>
  );
}
