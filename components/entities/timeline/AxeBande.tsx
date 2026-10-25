"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { dateAtYearPosition } from "@/src/core/calendar/axisPosition";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { GameDate } from "@/src/core/calendar/types";
import type { TimelineEntry } from "@/src/core/schemas/blocks/timeline";
import {
  anAuPourcent,
  calculerDomaine,
  marquesAxe,
  positionAujourdhui,
  positionnerEntrees,
  segmentsEres,
  teinteGenre,
  type TeinteGenre,
} from "@/lib/ui/axeBande";

/** Pastille de couleur d'un genre (jetons de la charte) — classes écrites en entier pour que Tailwind les voie. */
const POINT_PAR_TEINTE: Record<TeinteGenre, string> = {
  success: "bg-success",
  danger: "bg-danger",
  gm: "bg-gm",
  players: "bg-players",
  neutre: "bg-ink-muted",
};

/** Sous ce déplacement (px), un appui-relâche reste un toucher (un point) — au-delà, c'est une période. */
const SEUIL_GLISSE_PX = 5;

/**
 * V3.1-68 — l'axe en bande du bloc Chronologie : les ères du calendrier en
 * segments nommés, les périodes en barres, les événements en points, le jour
 * actuel en trait doré (absent tant que le MJ n'a pas réglé la date du jour).
 * Toucher l'axe ajoute un événement à cette date ; glisser, une période.
 * L'axe cadre toujours tout ce qui est posé : pas de zoom ni de panoramique
 * (la vue publique garde `TimelineAxis`). Tout le calcul est dans
 * `lib/ui/axeBande.ts`.
 */
export default function AxeBande({
  entries,
  calendar,
  selectedEntryId,
  onSelectEntry,
  onCreateEntry,
}: {
  entries: TimelineEntry[];
  calendar: CalendarConfigInput;
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onCreateEntry: (date: GameDate) => void;
}) {
  const t = useTranslations("fiche.chronologie");
  const bandeRef = useRef<HTMLDivElement>(null);
  const departRef = useRef<{ x: number; pct: number } | null>(null);
  const [apercu, setApercu] = useState<{ a: number; b: number } | null>(null);

  const entrees = positionnerEntrees(entries, calendar);
  const aujourdhui = positionAujourdhui(calendar.currentDate, calendar);
  const domaine = calculerDomaine(entrees, aujourdhui);
  const marques = marquesAxe(entrees, aujourdhui, domaine);
  const eres = segmentsEres(calendar.eras, domaine);
  const parId = new Map(entries.map((e) => [e.id, e]));

  function pctSous(clientX: number): number {
    const rect = bandeRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function finir(clientX: number) {
    const depart = departRef.current;
    departRef.current = null;
    setApercu(null);
    if (!depart) return;
    const fin = pctSous(clientX);
    if (Math.abs(clientX - depart.x) < SEUIL_GLISSE_PX) {
      onCreateEntry(dateAtYearPosition(anAuPourcent(depart.pct, domaine), calendar));
      return;
    }
    const de = dateAtYearPosition(anAuPourcent(Math.min(depart.pct, fin), domaine), calendar);
    const a = dateAtYearPosition(anAuPourcent(Math.max(depart.pct, fin), domaine), calendar);
    onCreateEntry({ ...de, end: { year: a.year, month: a.month, day: a.day } });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={bandeRef}
        role="group"
        aria-label={t("axe")}
        className="relative h-16 cursor-crosshair select-none overflow-hidden rounded-xl border border-edge bg-panel-sunken"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const pct = pctSous(e.clientX);
          departRef.current = { x: e.clientX, pct };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const depart = departRef.current;
          if (depart && Math.abs(e.clientX - depart.x) >= SEUIL_GLISSE_PX) setApercu({ a: depart.pct, b: pctSous(e.clientX) });
        }}
        onPointerUp={(e) => finir(e.clientX)}
        onPointerCancel={() => {
          departRef.current = null;
          setApercu(null);
        }}
      >
        {/* Les ères : segments nommés en haut de la bande */}
        {eres.map((ere, i) => (
          <div
            key={`${ere.nom}-${i}`}
            className={`pointer-events-none absolute top-0 h-5 truncate border-l border-edge-strong px-1.5 text-xs leading-5 text-ink-muted ${i % 2 === 0 ? "bg-ink/[0.04]" : ""}`}
            style={{ left: `${ere.gauche}%`, width: `${ere.largeur}%` }}
          >
            {ere.nom}
          </div>
        ))}

        <div className="pointer-events-none absolute inset-x-0 top-[38px] h-0.5 bg-edge-strong" />

        {apercu && (
          <div
            className="pointer-events-none absolute top-[34px] h-2 rounded-full bg-accent/40"
            style={{ left: `${Math.min(apercu.a, apercu.b)}%`, width: `${Math.abs(apercu.b - apercu.a)}%` }}
          />
        )}

        {marques.periodes.map((p) => {
          const entry = parId.get(p.id);
          if (!entry) return null;
          const choisie = p.id === selectedEntryId;
          return (
            <button
              key={p.id}
              type="button"
              aria-label={t("periode", { titre: entry.title })}
              aria-pressed={choisie}
              title={entry.title}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelectEntry(p.id)}
              className={`absolute top-[34px] h-2 rounded-full transition-colors ${POINT_PAR_TEINTE[teinteGenre(entry.kind)]} ${
                choisie ? "opacity-100 ring-2 ring-accent" : "opacity-70 hover:opacity-100"
              }`}
              style={{ left: `${p.gauche}%`, width: `${Math.max(p.largeur, 0.8)}%` }}
            />
          );
        })}

        {marques.points.map((p) => {
          const entry = parId.get(p.id);
          if (!entry) return null;
          const choisie = p.id === selectedEntryId;
          return (
            <button
              key={p.id}
              type="button"
              aria-label={entry.title || t("sansTitre")}
              aria-pressed={choisie}
              title={entry.title}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelectEntry(p.id)}
              className={`absolute top-[39px] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel transition-shadow ${POINT_PAR_TEINTE[teinteGenre(entry.kind)]} ${
                choisie ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-edge-strong"
              }`}
              style={{ left: `${p.gauche}%` }}
            />
          );
        })}

        {/* Le jour actuel du monde : un trait doré, seulement si la date est réglée */}
        {marques.aujourdhui !== null && (
          <div
            className="pointer-events-none absolute bottom-2 top-2 w-0.5 bg-accent shadow-[0_0_8px_var(--accent)]"
            style={{ left: `${marques.aujourdhui}%` }}
            title={t("aujourdhui")}
          />
        )}
      </div>
      <p className="text-xs text-ink-muted">{t("axeAide")}</p>
    </div>
  );
}
