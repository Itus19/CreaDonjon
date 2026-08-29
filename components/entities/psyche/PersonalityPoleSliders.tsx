"use client";

import { useRef, useState } from "react";
import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "@/src/core/psyche/keys";
import { PERSONALITY_POLE_DESCRIPTIONS_FR } from "@/src/i18n/fr";

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
  onLiveChange,
  disabled,
}: {
  poles: { key: PersonalityPoleKey; value: number }[];
  onCommit: (key: PersonalityPoleKey, delta: number) => Promise<void> | void;
  /** Remonte la position en cours de glissement au parent (radar en direct) — `null` efface l'ecrasement local. */
  onLiveChange?: (key: PersonalityPoleKey, value: number | null) => void;
  disabled?: boolean;
}) {
  const [liveValues, setLiveValues] = useState<Record<string, number>>({});
  // Miroir synchrone de `liveValues`, meme motif que `blocksRef` dans
  // EntityBlocks.tsx : sur un clic (pas seulement un glisse), `onChange`
  // (evenement 'input') et `onMouseUp` peuvent survenir dans le meme
  // batch React — `commit` lisait alors `liveValues` via la fermeture du
  // rendu en cours, PERIME tant que React n'a pas rejoue ce batch. Le
  // curseur ne bougeait jamais : `current` valait `undefined`, le retour
  // anticipe annulait tout silencieusement. Bug reel signale par l'utilisateur.
  const liveValuesRef = useRef<Record<string, number>>({});
  const dragStartRef = useRef<Record<string, number>>({});
  // Un `commit` en cours pour une cle : la desactivation du curseur pendant
  // la sauvegarde (`disabled={sliderPending}`) force un `blur` natif, qui
  // rappelle `commit` une seconde fois AVANT que la premiere requete ait
  // fini. Sans ce garde, ce second appel effacait la valeur locale tout de
  // suite — le curseur (et le radar) retombait un instant sur l'ancienne
  // valeur puis re-sautait sur la nouvelle a la reponse du serveur. C'etait
  // le "temps de latence bizarre" signale par l'utilisateur.
  const committingRef = useRef<Record<string, boolean>>({});

  const valueOf = (key: PersonalityPoleKey, fallback: number) => liveValues[key] ?? fallback;

  function setLiveValue(key: PersonalityPoleKey, value: number) {
    liveValuesRef.current = { ...liveValuesRef.current, [key]: value };
    setLiveValues(liveValuesRef.current);
    onLiveChange?.(key, value);
  }

  function clearLiveValue(key: PersonalityPoleKey) {
    const next = { ...liveValuesRef.current };
    delete next[key];
    liveValuesRef.current = next;
    setLiveValues(next);
    onLiveChange?.(key, null);
  }

  function startDrag(key: PersonalityPoleKey, current: number) {
    dragStartRef.current[key] = current;
  }

  async function commit(key: PersonalityPoleKey) {
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
      // Efface la valeur locale seulement maintenant : succes ou non, `poles`
      // (la prop) reflete deja la verite — la valeur enregistree si l'appel a
      // reussi, l'ancienne sinon (delta > 40 non confirme, conflit serveur...).
      clearLiveValue(key);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {PERSONALITY_POLE_KEYS.map((key) => {
        const stored = poles.find((p) => p.key === key)?.value ?? 0;
        const value = valueOf(key, stored);
        const ends = POLE_ENDS_FR[key];
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <div
              className="flex items-center justify-between text-[10px] text-ink-muted"
              title={PERSONALITY_POLE_DESCRIPTIONS_FR[key]}
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
