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

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex items-center justify-between text-xs font-mono text-ink">
        <span>{formatTime(startMinutes)}</span>
        <span>{formatTime(endMinutes)}</span>
      </div>
      <div ref={trackRef} className="relative h-1.5 rounded-full bg-panel-sunken">
        <div className="absolute h-1.5 rounded-full bg-accent" style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }} />
        <button
          type="button"
          aria-label="Heure de début"
          onMouseDown={() => (draggingRef.current = "start")}
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-accent bg-panel-raised active:cursor-grabbing"
          style={{ left: `${startPct}%` }}
        />
        <button
          type="button"
          aria-label="Heure de fin"
          onMouseDown={() => (draggingRef.current = "end")}
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-accent bg-panel-raised active:cursor-grabbing"
          style={{ left: `${endPct}%` }}
        />
      </div>
    </div>
  );
}
