"use client";

import { useRef, useState } from "react";
import { WORLDVIEW_POLE_KEYS, type WorldviewPoleKey } from "@/src/core/psyche/keys";
import { WORLDVIEW_POLE_DESCRIPTIONS_FR } from "@/src/i18n/fr";

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
  onLiveChange,
  disabled,
}: {
  poles: { key: WorldviewPoleKey; value: number }[];
  onCommit: (key: WorldviewPoleKey, delta: number) => Promise<void> | void;
  /** Remonte la position en cours de glissement au parent (radar en direct) — `null` efface l'ecrasement local. */
  onLiveChange?: (key: WorldviewPoleKey, value: number | null) => void;
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
  // Un `commit` en cours pour une cle : la desactivation du curseur pendant
  // la sauvegarde (`disabled={sliderPending}`) force un `blur` natif, qui
  // rappelle `commit` une seconde fois AVANT que la premiere requete ait
  // fini. Sans ce garde, ce second appel effacait la valeur locale tout de
  // suite — retour en arriere visible puis re-saut a la reponse du serveur.
  const committingRef = useRef<Record<string, boolean>>({});

  const valueOf = (key: WorldviewPoleKey, fallback: number) => liveValues[key] ?? fallback;

  function setLiveValue(key: WorldviewPoleKey, value: number) {
    liveValuesRef.current = { ...liveValuesRef.current, [key]: value };
    setLiveValues(liveValuesRef.current);
    onLiveChange?.(key, value);
  }

  function clearLiveValue(key: WorldviewPoleKey) {
    const next = { ...liveValuesRef.current };
    delete next[key];
    liveValuesRef.current = next;
    setLiveValues(next);
    onLiveChange?.(key, null);
  }

  function startDrag(key: WorldviewPoleKey, current: number) {
    dragStartRef.current[key] = current;
  }

  async function commit(key: WorldviewPoleKey) {
    if (committingRef.current[key]) return;
    const start = dragStartRef.current[key];
    const current = liveValuesRef.current[key];
    delete dragStartRef.current[key];
    if (start === undefined || current === undefined || current === start) {
      clearLiveValue(key);
      return;
    }
    committingRef.current[key] = true;
    try {
      await onCommit(key, current - start);
    } finally {
      committingRef.current[key] = false;
      clearLiveValue(key);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {WORLDVIEW_POLE_KEYS.map((key) => {
        const stored = poles.find((p) => p.key === key)?.value ?? 0;
        const value = valueOf(key, stored);
        const ends = POLE_ENDS_FR[key];
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <div
              className="flex items-center justify-between text-[10px] text-ink-muted"
              title={WORLDVIEW_POLE_DESCRIPTIONS_FR[key]}
            >
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
