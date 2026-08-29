"use client";

import { useRef, useState } from "react";
import { RELATIONSHIP_AXIS_KEYS, type RelationshipAxisKey } from "@/src/core/psyche/keys";

const AXIS_ENDS_FR: Record<RelationshipAxisKey, { positive: string; negative: string }> = {
  trust_distrust: { positive: "Confiance", negative: "Méfiance" },
  friendship_hostility: { positive: "Amitié", negative: "Hostilité" },
  respect_contempt: { positive: "Respect", negative: "Mépris" },
  attraction_repulsion: { positive: "Attirance", negative: "Répulsion" },
  debt_independence: { positive: "Dette", negative: "Indépendance" },
  fear_assurance: { positive: "Peur", negative: "Assurance" },
  interest_indifference: { positive: "Intérêt", negative: "Indifférence" },
};

/** Curseurs -100/+100 du bloc `relationship` (V2-H1) — meme discipline que `PersonalityPoleSliders` : commit au relachement seulement, jamais silencieux. */
export default function RelationshipAxisSliders({
  axes,
  onCommit,
  disabled,
}: {
  axes: Partial<Record<RelationshipAxisKey, number>>;
  onCommit: (key: RelationshipAxisKey, delta: number) => void;
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

  const valueOf = (key: RelationshipAxisKey, fallback: number) => liveValues[key] ?? fallback;

  function setLiveValue(key: RelationshipAxisKey, value: number) {
    liveValuesRef.current = { ...liveValuesRef.current, [key]: value };
    setLiveValues(liveValuesRef.current);
  }

  function clearLiveValue(key: RelationshipAxisKey) {
    const next = { ...liveValuesRef.current };
    delete next[key];
    liveValuesRef.current = next;
    setLiveValues(next);
  }

  function startDrag(key: RelationshipAxisKey, current: number) {
    dragStartRef.current[key] = current;
  }

  function commit(key: RelationshipAxisKey) {
    const start = dragStartRef.current[key];
    const current = liveValuesRef.current[key];
    delete dragStartRef.current[key];
    clearLiveValue(key);
    if (start === undefined || current === undefined || current === start) return;
    onCommit(key, current - start);
  }

  return (
    <div className="flex flex-col gap-3">
      {RELATIONSHIP_AXIS_KEYS.map((key) => {
        const stored = axes[key] ?? 0;
        const value = valueOf(key, stored);
        const ends = AXIS_ENDS_FR[key];
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
