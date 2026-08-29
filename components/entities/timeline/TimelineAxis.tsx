"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { yearPosition, dateAtYearPosition } from "@/src/core/calendar/axisPosition";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { GameDate } from "@/src/core/calendar/types";
import type { TimelineEntry } from "@/src/core/schemas/blocks/timeline";

const HEIGHT = 170;
const AXIS_Y = 90;
const MIN_PX_PER_YEAR = 0.05;
const MAX_PX_PER_YEAR = 4000;
/** En dessous de ce deplacement (px), un clic-relache reste un clic (ajoute un point) — pas un glisse (ajoute une periode). */
const DRAG_THRESHOLD = 5;
const NICE_YEAR_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
/** Espacement cible entre deux graduations, pour choisir le pas "rond" le plus proche. */
const TARGET_TICK_SPACING_PX = 90;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function niceYearStep(pxPerYear: number): number {
  for (const step of NICE_YEAR_STEPS) {
    if (step * pxPerYear >= TARGET_TICK_SPACING_PX) return step;
  }
  return NICE_YEAR_STEPS[NICE_YEAR_STEPS.length - 1];
}

/**
 * Axe horizontal de la chronologie (V2-H2, reprise visuelle sur references
 * fournies par l'utilisateur) — pan (glisser) + zoom (molette centree sur
 * le curseur, horizontal seulement), cadrage automatique sur les entrees
 * existantes. Cliquer sur l'axe cree une entree ponctuelle a cette date ;
 * glisser cree une periode (`date.end` pose) — reutilise le meme champ que
 * le formulaire au lieu d'un second systeme d'"eres" dessinees a part.
 *
 * Vue purement spatiale : l'edition complete (titre, genre, resume,
 * visibilite, promotion) reste dans la liste en dessous
 * (`TimelineBlockEditor.tsx`) — cliquer un marqueur y fait defiler jusqu'a
 * la ligne correspondante plutot que de dupliquer un formulaire ici.
 */
export default function TimelineAxis({
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
  /** Omis en lecture seule (wiki public, `PublicTimelineBlock`) : pan/zoom et clic sur une entree existante restent actifs, mais plus d'ajout par clic/glisse ni d'apercu "cliquer pour ajouter". */
  onCreateEntry?: (date: GameDate) => void;
}) {
  const readOnly = !onCreateEntry;
  const [view, setView] = useState({ x: 0, pxPerYear: 8 });
  const [containerWidth, setContainerWidth] = useState(800);
  const [isPanning, setIsPanning] = useState(false);
  const [hoverScreenX, setHoverScreenX] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<{ startScreenX: number; endScreenX: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startPanX: number; moved: boolean } | null>(null);
  const createDragRef = useRef<{ startScreenX: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const fittedForRef = useRef<string | null>(null);

  const positions = entries.map((e) => ({
    entry: e,
    start: yearPosition(e.date, calendar),
    end: e.date.end ? yearPosition({ year: e.date.end.year, month: e.date.end.month, day: e.date.end.day }, calendar) : null,
  }));

  const entriesSignature = entries.map((e) => `${e.id}:${e.date.year}:${e.date.month}:${e.date.day}`).join(",");

  // Cadre et centre sur les entrees existantes a l'ouverture et a chaque
  // changement de date/nombre d'entrees — jamais a chaque re-rendu, ce qui
  // effacerait un panoramique/zoom manuel en cours.
  useLayoutEffect(() => {
    if (fittedForRef.current === entriesSignature) return;
    fittedForRef.current = entriesSignature;
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    if (positions.length === 0) {
      setView({ x: width / 2, pxPerYear: 8 });
      return;
    }
    const starts = positions.map((p) => p.start);
    const ends = positions.map((p) => p.end ?? p.start);
    const minYear = Math.min(...starts, ...ends);
    const maxYear = Math.max(...starts, ...ends);
    const span = Math.max(maxYear - minYear, 1);
    const padded = span * 1.3;
    const fitScale = clamp(width / padded, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
    const centerYear = (minYear + maxYear) / 2;
    setView({ x: width / 2 - centerYear * fitScale, pxPerYear: fitScale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entriesSignature]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      setView((current) => {
        const nextScale = clamp(current.pxPerYear * (1 - e.deltaY * 0.001), MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
        const worldYear = (cursorX - current.x) / current.pxPerYear;
        return { pxPerYear: nextScale, x: cursorX - worldYear * nextScale };
      });
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // Largeur suivie en etat (jamais lue depuis le ref pendant le rendu,
  // regle des hooks) — sert au calcul des graduations visibles.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setContainerWidth(container.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  function screenXFor(yearPos: number): number {
    return view.x + yearPos * view.pxPerYear;
  }
  function yearAtScreenX(screenX: number): number {
    return (screenX - view.x) / view.pxPerYear;
  }
  function screenXFromClientX(clientX: number): number {
    const rect = containerRef.current?.getBoundingClientRect();
    return clientX - (rect?.left ?? 0);
  }

  function handleBackgroundMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const screenX = screenXFromClientX(e.clientX);
    panRef.current = { startX: e.clientX, startPanX: view.x, moved: false };
    if (!readOnly) createDragRef.current = { startScreenX: screenX, moved: false };
    setIsPanning(true);
  }

  function handleMouseMove(e: React.MouseEvent) {
    const screenX = screenXFromClientX(e.clientX);
    if (!readOnly) setHoverScreenX(screenX);

    const pan = panRef.current;
    if (!pan) return;
    const dx = e.clientX - pan.startX;
    if (!pan.moved && Math.abs(dx) > DRAG_THRESHOLD) pan.moved = true;
    if (pan.moved) {
      setView((current) => ({ ...current, x: pan.startPanX + dx }));
      if (createDragRef.current) createDragRef.current.moved = true;
    }
    if (createDragRef.current?.moved) {
      setDragPreview({ startScreenX: createDragRef.current.startScreenX, endScreenX: screenX });
    }
  }

  function endInteraction(e: React.MouseEvent) {
    const create = createDragRef.current;
    const pan = panRef.current;
    panRef.current = null;
    createDragRef.current = null;
    setIsPanning(false);
    setDragPreview(null);

    if (pan?.moved) suppressClickRef.current = true;
    if (!create) return;

    // Un panoramique (glisse la vue) et un glisse-pour-creer-une-periode
    // sont le MEME geste physique sur cet axe (pas de bouton "mode" separe
    // comme la reference) : si la souris a bouge plus que le seuil, on
    // cree une periode plutot que de deplacer la vue — le panoramique se
    // fait alors uniquement a la molette/au clic-glisse sur un marqueur
    // deja pose n'existe pas ici, ce qui est assume : glisser PAN et
    // glisser CREER sont la meme action, dernier geste gagne.
    const endScreenX = screenXFromClientX(e.clientX);
    const startYear = yearAtScreenX(create.startScreenX);
    const endYear = yearAtScreenX(endScreenX);

    if (!onCreateEntry) return;
    if (!create.moved) {
      onCreateEntry(dateAtYearPosition(startYear, calendar));
    } else {
      const from = dateAtYearPosition(Math.min(startYear, endYear), calendar);
      const to = dateAtYearPosition(Math.max(startYear, endYear), calendar);
      onCreateEntry({ ...from, end: { year: to.year, month: to.month, day: to.day } });
    }
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }

  function zoomBy(factor: number) {
    const container = containerRef.current;
    if (!container) return;
    const centerX = container.clientWidth / 2;
    setView((current) => {
      const nextScale = clamp(current.pxPerYear * factor, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
      const worldYear = (centerX - current.x) / current.pxPerYear;
      return { pxPerYear: nextScale, x: centerX - worldYear * nextScale };
    });
  }

  const visibleStartYear = yearAtScreenX(0);
  const visibleEndYear = yearAtScreenX(containerWidth);
  const step = niceYearStep(view.pxPerYear);
  const ticks: number[] = [];
  for (let y = Math.floor(visibleStartYear / step) * step; y <= visibleEndYear + step; y += step) {
    ticks.push(y);
  }

  const hoverDate =
    !readOnly && hoverScreenX !== null && !isPanning ? dateAtYearPosition(yearAtScreenX(hoverScreenX), calendar) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={containerRef}
        className={`relative select-none overflow-hidden rounded-xl border border-edge/60 ${isPanning ? "cursor-grabbing" : readOnly ? "cursor-grab" : "cursor-crosshair"}`}
        style={{
          height: HEIGHT,
          backgroundImage: "radial-gradient(var(--edge) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          backgroundColor: "color-mix(in oklch, var(--panel-sunken) 60%, transparent)",
        }}
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endInteraction}
        onMouseLeave={() => {
          setHoverScreenX(null);
          if (panRef.current || createDragRef.current) {
            panRef.current = null;
            createDragRef.current = null;
            setIsPanning(false);
            setDragPreview(null);
          }
        }}
        onClickCapture={handleClickCapture}
      >
        {/* Ligne d'axe */}
        <div className="absolute left-0 right-0 border-t border-edge-strong" style={{ top: AXIS_Y }} />

        {/* Graduations */}
        {ticks.map((y) => (
          <div key={y} className="pointer-events-none absolute top-0 flex h-full flex-col items-center" style={{ left: screenXFor(y) }}>
            <span className="mt-1 text-[10px] text-ink-muted">{y}</span>
            <div className="mt-auto mb-1 h-2 border-l border-edge/60" />
          </div>
        ))}

        {/* Previsualisation de creation (glisse en cours) */}
        {dragPreview && (
          <div
            className="pointer-events-none absolute rounded-full bg-accent/30"
            style={{
              left: Math.min(dragPreview.startScreenX, dragPreview.endScreenX),
              width: Math.abs(dragPreview.endScreenX - dragPreview.startScreenX),
              top: AXIS_Y - 4,
              height: 8,
            }}
          />
        )}

        {/* Aperçu de la date sous le curseur, hors glisse — meme esprit que "click to add" de la reference */}
        {hoverDate && !dragPreview && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-full border border-edge-strong bg-panel-raised px-2 py-0.5 text-[10px] text-ink-muted shadow"
            style={{ left: hoverScreenX!, top: AXIS_Y + 14 }}
          >
            {formatGameDate(hoverDate, calendar)} · cliquer pour ajouter
          </div>
        )}

        {/* Entrees */}
        {positions.map(({ entry, start, end }) => {
          const isSelected = entry.id === selectedEntryId;
          const x = screenXFor(start);
          if (end !== null) {
            const x2 = screenXFor(end);
            return (
              <div key={entry.id} className="pointer-events-none absolute" style={{ left: Math.min(x, x2), top: AXIS_Y - 3 }}>
                <button
                  type="button"
                  className={`pointer-events-auto block rounded-full ${isSelected ? "bg-accent" : "bg-edge-strong hover:bg-accent/70"}`}
                  style={{ width: Math.abs(x2 - x), height: 6 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEntry(entry.id);
                  }}
                  aria-label={entry.title}
                />
                <span
                  className={`pointer-events-none absolute top-[-18px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] ${isSelected ? "font-semibold text-ink" : "text-ink-soft"}`}
                >
                  {entry.title}
                </span>
              </div>
            );
          }
          return (
            <button
              key={entry.id}
              type="button"
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: x, top: AXIS_Y }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEntry(entry.id);
              }}
            >
              <span
                className={`block rounded-full border-2 ${isSelected ? "border-accent bg-accent" : "border-edge-strong bg-panel-raised hover:border-accent"}`}
                style={{ width: isSelected ? 12 : 9, height: isSelected ? 12 : 9 }}
              />
              <span
                className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] ${isSelected ? "font-semibold text-ink" : "text-ink-soft"}`}
              >
                {entry.title || "(sans titre)"}
              </span>
            </button>
          );
        })}

        <div className="absolute bottom-2 right-2 flex gap-1">
          <button
            type="button"
            onClick={() => zoomBy(1.4)}
            className="rounded-md border border-edge-strong bg-panel-raised px-2 py-1 text-xs text-ink transition-colors hover:bg-panel"
            aria-label="Zoomer"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.4)}
            className="rounded-md border border-edge-strong bg-panel-raised px-2 py-1 text-xs text-ink transition-colors hover:bg-panel"
            aria-label="Dézoomer"
          >
            −
          </button>
        </div>
      </div>
      <p className="text-[10px] text-ink-muted">
        {readOnly
          ? "Molette pour zoomer, glisser pour déplacer."
          : "Cliquer sur l'axe ajoute un événement à cette date · glisser ajoute une période. Molette pour zoomer, glisser pour déplacer."}
      </p>
    </div>
  );
}
