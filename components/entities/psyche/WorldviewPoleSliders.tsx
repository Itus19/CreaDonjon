"use client";

import { useRef, useState } from "react";
import { WORLDVIEW_POLE_KEYS, type WorldviewPoleKey } from "@/src/core/psyche/keys";

const POLE_ENDS_FR: Record<WorldviewPoleKey, { positive: string; negative: string }> = {
  order_freedom: { positive: "Liberté", negative: "Ordre" },
  mercy_justice: { positive: "Justice", negative: "Miséricorde" },
  sacred_profane: { positive: "Profane", negative: "Sacré" },
  tradition_progress: { positive: "Progrès", negative: "Tradition" },
  individual_collective: { positive: "Collectif", negative: "Individu" },
  wealth_honor: { positive: "Honneur", negative: "Richesse" },
  peace_force: { positive: "Force", negative: "Paix" },
};

/** Curseurs -100/+100 du bloc `worldview` (V2-H1) — meme discipline que `PersonalityPoleSliders` : commit au relachement seulement. */
export default function WorldviewPoleSliders({
  poles,
  onCommit,
  disabled,
}: {
  poles: { key: WorldviewPoleKey; value: number }[];
  onCommit: (key: WorldviewPoleKey, delta: number) => void;
  disabled?: boolean;
}) {
  const [liveValues, setLiveValues] = useState<Record<string, number>>({});
  // Miroir synchrone, meme motif que `blocksRef` (EntityBlocks.tsx) : sur
  // un clic (pas seulement un glisse), `onChange` et `onMouseUp` peuvent
  // survenir dans le meme batch React — lire `liveValues` via la fermeture
  // du rendu en cours dans `commit` le rendait PERIME, le curseur ne
  // bougeait jamais. Bug reel signale par l'utilisateur.
  const liveValuesRef = useRef<Record<string, number>>({});
  const dragStartRef = useRef<Record<string, number>>({});

  const valueOf = (key: WorldviewPoleKey, fallback: number) => liveValues[key] ?? fallback;

  function setLiveValue(key: WorldviewPoleKey, value: number) {
    liveValuesRef.current = { ...liveValuesRef.current, [key]: value };
    setLiveValues(liveValuesRef.current);
  }

  function clearLiveValue(key: WorldviewPoleKey) {
    const next = { ...liveValuesRef.current };
    delete next[key];
    liveValuesRef.current = next;
    setLiveValues(next);
  }

  function startDrag(key: WorldviewPoleKey, current: number) {
    dragStartRef.current[key] = current;
  }

  function commit(key: WorldviewPoleKey) {
    const start = dragStartRef.current[key];
    const current = liveValuesRef.current[key];
    delete dragStartRef.current[key];
    clearLiveValue(key);
    if (start === undefined || current === undefined || current === start) return;
    onCommit(key, current - start);
  }

  return (
    <div className="flex flex-col gap-3">
      {WORLDVIEW_POLE_KEYS.map((key) => {
        const stored = poles.find((p) => p.key === key)?.value ?? 0;
        const value = valueOf(key, stored);
        const ends = POLE_ENDS_FR[key];
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[10px] text-ink-muted">
              <span>{ends.negative}</span>
              <span className="font-mono text-ink">{value}</span>
              <span>{ends.positive}</span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              value={value}
              disabled={disabled}
              onMouseDown={() => startDrag(key, stored)}
              onTouchStart={() => startDrag(key, stored)}
              onFocus={() => startDrag(key, stored)}
              onChange={(e) => setLiveValue(key, Number(e.target.value))}
              onMouseUp={() => commit(key)}
              onTouchEnd={() => commit(key)}
              onBlur={() => commit(key)}
              className="w-full accent-accent"
            />
          </div>
        );
      })}
    </div>
  );
}
