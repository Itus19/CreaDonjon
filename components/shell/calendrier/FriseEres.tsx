"use client";

import { useTranslations } from "next-intl";
import { eraBand } from "@/src/core/calendar/navigation";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

/**
 * La frise des ères (V3.1-55) : une bande, chaque ère de largeur proportionnelle
 * à sa durée (`eraBand`), l'an actuel marqué d'un trait accent et de son année.
 * La toucher ouvre le réglage des ères.
 */
export default function FriseEres({
  calendrier,
  actif,
  onOuvrir,
}: {
  calendrier: CalendarConfigInput;
  actif: boolean;
  onOuvrir: () => void;
}) {
  const t = useTranslations("calendrier");
  const anActuel = calendrier.currentDate?.year ?? 0;
  const { segments, current } = eraBand(calendrier, anActuel);

  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-label={t("friseOuvrir")}
      aria-pressed={actif}
      className={`flex w-full flex-col gap-1 rounded-xl border bg-panel p-3 text-left transition-colors hover:bg-panel-raised ${
        actif ? "border-accent" : "border-edge"
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("friseTitre")}</span>
      {segments.length === 0 ? (
        <span className="py-3 text-xs italic text-ink-muted">{t("friseVide")}</span>
      ) : (
        <>
          <div className="relative h-4">
            {current !== null && calendrier.currentDate && (
              <span
                className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-accent"
                style={{ left: `${Math.min(92, Math.max(8, current * 100))}%` }}
              >
                {t("anFrise", { annee: anActuel })}
              </span>
            )}
          </div>
          <div className="relative flex h-9 overflow-hidden rounded-lg border border-edge">
            {segments.map((segment, i) => (
              <span
                key={`${segment.startYear}-${i}`}
                className={`flex items-center overflow-hidden border-edge px-2 text-xs text-ink ${
                  i % 2 === 0 ? "bg-panel-raised" : "bg-panel-sunken"
                } ${i > 0 ? "border-l" : ""}`}
                style={{ flexGrow: segment.fraction, flexBasis: 0, minWidth: 0 }}
                title={segment.name}
              >
                <span className="truncate">{segment.name}</span>
              </span>
            ))}
            {current !== null && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 w-0.5 bg-accent"
                style={{ left: `${current * 100}%` }}
              />
            )}
          </div>
        </>
      )}
    </button>
  );
}
