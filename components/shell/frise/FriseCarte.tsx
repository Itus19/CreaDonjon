"use client";

import { useTranslations } from "next-intl";
import VisibilityPill from "@/components/shared/VisibilityPill";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { TimelineScope } from "@/src/core/schemas/blocks/timeline";
import { CARD_WIDTH } from "@/src/core/timeline/view";
import { estModifiable, porteeSuivante } from "@/lib/ui/frise";
import { teinteGenre, type TeinteGenre } from "@/lib/ui/axeBande";
import type { WorldTimelineEntry } from "@/src/server/services/timeline";

/** Couleur du genre : pastille de la carte et point sur l'axe (classes écrites en entier pour Tailwind). */
export const POINT_PAR_TEINTE: Record<TeinteGenre, string> = {
  success: "bg-success",
  danger: "bg-danger",
  gm: "bg-gm",
  players: "bg-players",
  neutre: "bg-ink-muted",
};

/** Hauteur de la tige entre l'axe et la carte, en px. */
export const TIGE = 36;

/**
 * Une carte de la frise (V3.1-98) : genre, date, titre (lien si fiche), d'où
 * vient la date et, pour le MJ, la pastille de visibilité et la pastille de
 * portée. Toucher la carte ouvre son détail ; les pastilles et les liens ne
 * l'ouvrent pas.
 */
export default function FriseCarte({
  item,
  calendrier,
  baseFiche,
  x,
  cote,
  hauteurStade,
  choisie,
  estMj,
  plusAutour,
  onChoisir,
  onPortee,
  onVisibilite,
  onZoomerAutour,
}: {
  item: WorldTimelineEntry;
  calendrier: CalendarConfigInput;
  /** Début de l'adresse d'une fiche : `/m/<monde>/f` pour le MJ, `/m/<monde>/joueur/wiki` pour un joueur. */
  baseFiche: string;
  x: number;
  cote: "above" | "below";
  hauteurStade: number;
  choisie: boolean;
  /** MJ hors « vue des joueurs » : voit et règle les pastilles. */
  estMj: boolean;
  plusAutour: number;
  onChoisir: () => void;
  onPortee: (suivante: TimelineScope) => void;
  onVisibilite: (niveau: string) => Promise<boolean>;
  onZoomerAutour: () => void;
}) {
  const t = useTranslations("frise");
  const tg = useTranslations("fiche.chronologie.genres");
  const { entry } = item;
  const ref = item.refEntitySlug;
  const modifiable = estMj && estModifiable(item);
  const suivante = porteeSuivante(item.scope);

  const provenance =
    item.source.kind === "entity" ? (
      <a
        href={`${baseFiche}/${item.sourceEntitySlug}`}
        onClick={(e) => e.stopPropagation()}
        className="truncate text-xs text-ink-muted hover:underline"
      >
        {t("carte.source.entity", { nom: item.sourceEntityName })}
      </a>
    ) : (
      <span className="truncate text-xs text-ink-muted">{t(`carte.source.${item.source.kind}`)}</span>
    );

  return (
    <div
      data-sans-glisser
      style={{ left: x - CARD_WIDTH / 2, width: CARD_WIDTH, ...(cote === "above" ? { bottom: hauteurStade / 2 + TIGE } : { top: hauteurStade / 2 + TIGE }) }}
      className="absolute z-10 flex flex-col gap-1"
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={t("carte.ouvrir", { titre: entry.title })}
        aria-pressed={choisie}
        onClick={onChoisir}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onChoisir();
          }
        }}
        className={`flex cursor-pointer flex-col gap-1 rounded-lg border bg-panel px-3 py-2 text-left transition-colors hover:bg-panel-raised ${
          choisie ? "border-accent" : "border-edge"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${POINT_PAR_TEINTE[teinteGenre(entry.kind)]}`} />
          <span className="truncate text-xs uppercase tracking-wider text-ink-muted">{tg(entry.kind)}</span>
        </div>
        <span className="font-mono text-xs text-ink-muted">{formatGameDate(entry.date, calendrier)}</span>
        <p className="line-clamp-2 text-sm font-semibold text-ink">
          {ref ? (
            <a href={`${baseFiche}/${ref}`} onClick={(e) => e.stopPropagation()} className="text-link-entity hover:underline">
              {entry.title}
            </a>
          ) : (
            entry.title
          )}
        </p>
        {provenance}
        {estMj && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
            {modifiable && (
              <VisibilityPill niveau={entry.visibility.level} onChange={onVisibilite} objet={t("carte.visibilite", { titre: entry.title })} sansPrive />
            )}
            {modifiable ? (
              <button
                type="button"
                onClick={() => onPortee(suivante)}
                aria-label={t("carte.porteeLabel", { titre: entry.title, portee: t(`carte.portee.${item.scope}`), suivante: t(`carte.portee.${suivante}`) })}
                className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
              >
                {t(`carte.portee.${item.scope}`)}
              </button>
            ) : (
              <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">{t(`carte.portee.${item.scope}`)}</span>
            )}
          </div>
        )}
      </div>
      {plusAutour > 0 && (
        <button
          type="button"
          onClick={onZoomerAutour}
          aria-label={t("autourLabel", { n: plusAutour, titre: entry.title })}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          {t("autour", { n: plusAutour })}
        </button>
      )}
    </div>
  );
}
