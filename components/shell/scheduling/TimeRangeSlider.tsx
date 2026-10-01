"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Curseur à deux poignées pour une plage horaire (V3.1-8, retour
 * utilisateur : "quasi copié-collé de ce que propose crab.fit") — une seule
 * piste, deux poignées glissables, plutôt que deux champs heure séparés.
 */
export default function TimeRangeSlider({
  startMinutes,
  endMinutes,
  onChange,
  min = 0,
  max = 24 * 60,
  step = 30,
}: {
  startMinutes: number;
  endMinutes: number;
  onChange: (value: { startMinutes: number; endMinutes: number }) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | null>(null);
  // Valeurs courantes accessibles depuis le gestionnaire `mousemove` global
  // (voir plus bas) sans le reabonner a chaque frame — ecrit en effet,
  // jamais pendant le rendu (regle react-hooks/refs).
  const valuesRef = useRef({ startMinutes, endMinutes });
  useLayoutEffect(() => {
    valuesRef.current = { startMinutes, endMinutes };
  });

  const minutesFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      return Math.round(raw / step) * step;
    },
    [min, max, step]
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const minutes = minutesFromClientX(e.clientX);
      const { startMinutes: s, endMinutes: en } = valuesRef.current;
      if (draggingRef.current === "start") {
        onChange({ startMinutes: Math.min(minutes, en - step), endMinutes: en });
      } else {
        onChange({ startMinutes: s, endMinutes: Math.max(minutes, s + step) });
      }
    }
    function onUp() {
      draggingRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onChange, minutesFromClientX, step]);

  const startPct = ((startMinutes - min) / (max - min)) * 100;
  const endPct = ((endMinutes - min) / (max - min)) * 100;

  function nudge(handle: "start" | "end", delta: number) {
    if (handle === "start") onChange({ startMinutes: Math.min(Math.max(min, startMinutes + delta), endMinutes - step), endMinutes });
    else onChange({ startMinutes, endMinutes: Math.max(Math.min(max, endMinutes + delta), startMinutes + step) });
  }

  // V3.1-16 (esquisse « Formulaire ») : chaque heure se règle aussi d'une
  // demi-heure au clic, à côté de la poignée qu'on glisse — plus précis
  // qu'un glisser sur une piste de 24 h, et accessible au clavier.
  const stepper = (handle: "start" | "end", value: number) => (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => nudge(handle, -step)}
        aria-label={handle === "start" ? "Commencer plus tôt" : "Finir plus tôt"}
        className="grid h-8 w-8 place-items-center rounded-full border border-edge text-ink hover:bg-panel-raised"
      >
        −
      </button>
      <span className="min-w-12 text-center font-mono text-sm text-ink">{formatTime(value)}</span>
      <button
        type="button"
        onClick={() => nudge(handle, step)}
        aria-label={handle === "start" ? "Commencer plus tard" : "Finir plus tard"}
        className="grid h-8 w-8 place-items-center rounded-full border border-edge text-ink hover:bg-panel-raised"
      >
        +
      </button>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-4 py-1">
      {stepper("start", startMinutes)}
      <div className="min-w-48 flex-1 px-2.5">
        <div ref={trackRef} className="relative h-2 rounded-full bg-panel-raised">
          <div className="absolute h-2 rounded-full bg-accent" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
          <button
            type="button"
            aria-label="Heure de début"
            onMouseDown={() => (draggingRef.current = "start")}
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] border-accent bg-ink active:cursor-grabbing"
            style={{ left: `${startPct}%` }}
          />
          <button
            type="button"
            aria-label="Heure de fin"
            onMouseDown={() => (draggingRef.current = "end")}
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[3px] border-accent bg-ink active:cursor-grabbing"
            style={{ left: `${endPct}%` }}
          />
        </div>
        {min === 0 && max === 24 * 60 && (
          <div className="mt-1.5 flex justify-between font-mono text-xs text-ink-muted">
            {[0, 6, 12, 18, 24].map((h) => (
              <span key={h}>{String(h).padStart(2, "0")}:00</span>
            ))}
          </div>
        )}
      </div>
      {stepper("end", endMinutes)}
    </div>
  );
}
