"use client";

import { useRef, useState } from "react";
import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "@/src/core/psyche/keys";

const POLE_ENDS_FR: Record<PersonalityPoleKey, { positive: string; negative: string }> = {
  curiosity_caution: { positive: "Curiosité", negative: "Prudence" },
  altruism_selfishness: { positive: "Altruisme", negative: "Égoïsme" },
  empathy_hardness: { positive: "Empathie", negative: "Dureté" },
  impulse_prudence: { positive: "Impulsivité", negative: "Prudence" },
  extraversion_reserve: { positive: "Extraversion", negative: "Réserve" },
  authority_independence: { positive: "Autorité", negative: "Indépendance" },
};

/**
 * Curseurs -100/+100 du bloc `personality` (V2-H1) — reglage manuel, mais
 * jamais silencieux : `onCommit` n'est appele qu'au relachement (pas a
 * chaque pixel glisse), et le parent journalise le delta via la meme
 * route que le tableau de souvenirs (specs/psyche-pnj.md §5, "le MJ
 * deplace les curseurs... cela cree un evenement").
 */
export default function PersonalityPoleSliders({
  poles,
  onCommit,
  disabled,
}: {
  poles: { key: PersonalityPoleKey; value: number }[];
  onCommit: (key: PersonalityPoleKey, delta: number) => void;
  disabled?: boolean;
}) {
  const [liveValues, setLiveValues] = useState<Record<string, number>>({});
  const dragStartRef = useRef<Record<string, number>>({});

  const valueOf = (key: PersonalityPoleKey, fallback: number) => liveValues[key] ?? fallback;

  function startDrag(key: PersonalityPoleKey, current: number) {
    dragStartRef.current[key] = current;
  }

  function commit(key: PersonalityPoleKey) {
    const start = dragStartRef.current[key];
    const current = liveValues[key];
    delete dragStartRef.current[key];
    // Efface la valeur locale tout de suite, succes ou non : si l'appelant
    // refuse (delta > 40 non confirme, conflit serveur...), l'affichage
    // retombe sur `poles` (la valeur reellement enregistree) plutot que de
    // rester bloque sur une valeur jamais sauvegardee.
    setLiveValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (start === undefined || current === undefined || current === start) return;
    onCommit(key, current - start);
  }

  return (
    <div className="flex flex-col gap-3">
      {PERSONALITY_POLE_KEYS.map((key) => {
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
              onChange={(e) => setLiveValues((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
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
