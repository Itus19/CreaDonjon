"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { averageHitDie } from "@/src/core/rules/sheet";

/** Un ou plusieurs niveaux de PV a traiter pour une classe, a la CREATION (V2-G1) — resolu a partir du niveau choisi, jamais devine ici. */
export interface CreationHpGrant {
  /** Index dans `character.classes` — pas la cle de regle, encore vide/instable tant que la classe n'est pas choisie. */
  classIndex: number;
  classKey: string;
  className: string;
  dieFaces: number;
  /** Niveaux de CETTE classe qui ne beneficient PAS de l'exemption "tout premier niveau du personnage" (ex. [2, 3] pour la premiere classe a niveau 3, ou [1, 2] pour une deuxieme classe choisie directement a 2). */
  levels: number[];
}

function modSuffix(conMod: number): string {
  if (conMod === 0) return "";
  return conMod > 0 ? `+${conMod}` : `${conMod}`;
}

/**
 * Etape "Points de vie" de l'assistant de CREATION (V2-G1, retour
 * utilisateur : "ces boutons de[vraient etre] disponibles dependant le
 * niveau choisi") — n'apparait que si au moins une classe demarre au-dela
 * du niveau exempte (le tres premier niveau du personnage). Contrairement a
 * `HpRollStep` (montee de niveau, ou le jet n'a lieu qu'a la confirmation
 * finale server-side), ici le jet est immediat, meme motif que "Lancer les
 * des" pour les caracteristiques (`AbilityScoreStep.tsx`,
 * `/api/character-creator/roll-abilities`) : l'assistant de creation ecrit
 * le bloc `character` tel quel a la fin, sans revalidation serveur — la
 * valeur doit donc deja etre definitive quand on quitte cette etape.
 */
export default function CreationHpRollStep({
  character,
  patchCharacter,
  grants,
  conMod,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  grants: CreationHpGrant[];
  conMod: number;
}) {
  const [rollingKey, setRollingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setRollAt(classIndex: number, index: number, value: number) {
    patchCharacter({
      classes: character.classes.map((c, i) => {
        if (i !== classIndex) return c;
        const rolls = [...(c.hp_rolls ?? [])];
        while (rolls.length <= index) rolls.push(value);
        rolls[index] = value;
        return { ...c, hp_rolls: rolls };
      }),
    });
  }

  async function rollAt(classIndex: number, index: number, dieFaces: number) {
    const key = `${classIndex}:${index}`;
    setRollingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/character-creator/roll-hp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dieFaces }),
      });
      if (!res.ok) {
        setError("Échec du jet.");
        return;
      }
      const body = (await res.json()) as { roll: number };
      setRollAt(classIndex, index, body.roll);
    } finally {
      setRollingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {grants.map((grant) => {
        const average = averageHitDie(grant.dieFaces);
        const rolls = character.classes[grant.classIndex]?.hp_rolls ?? [];
        return (
          <div key={grant.classIndex} className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
            <p className="text-sm font-medium text-ink">
              Points de vie — {grant.className} (d{grant.dieFaces})
            </p>
            <div className="flex flex-col gap-1.5">
              {grant.levels.map((level, i) => {
                const current = rolls[i];
                const busy = rollingKey === `${grant.classIndex}:${i}`;
                const isAverage = current === undefined || current === average;
                return (
                  <div key={level} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-ink-muted">Niveau {level}</span>
                    <button
                      type="button"
                      onClick={() => setRollAt(grant.classIndex, i, average)}
                      className={`rounded-full border px-2.5 py-1 transition-colors ${
                        isAverage ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                      }`}
                    >
                      Moyenne ({average}
                      {modSuffix(conMod)} = {average + conMod})
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => rollAt(grant.classIndex, i, grant.dieFaces)}
                      className={`rounded-full border px-2.5 py-1 transition-colors disabled:opacity-50 ${
                        !isAverage ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                      }`}
                    >
                      {busy
                        ? "Jet en cours…"
                        : !isAverage
                          ? `Jeté : ${current}${modSuffix(conMod)} = ${current + conMod}`
                          : `Jeter (1d${grant.dieFaces}${modSuffix(conMod)})`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
