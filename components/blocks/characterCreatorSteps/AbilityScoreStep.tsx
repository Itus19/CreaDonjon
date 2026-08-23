"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { AbilityScores } from "@/src/core/schemas/blocks/abilities";
import type { Ability } from "@/src/core/rules/sheet";
import { POINT_BUY_BUDGET, POINT_BUY_MAX, POINT_BUY_MIN, STANDARD_ARRAY, pointBuyCost } from "@/src/core/rules/abilityGeneration";
import Dropdown from "@/components/shared/Dropdown";

const ABILITY_LABELS: Record<Ability, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };
const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function modifierOf(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatMod(score: number): string {
  const mod = modifierOf(score);
  return `${mod >= 0 ? "+" : ""}${mod}`;
}

/**
 * Etape 3 du parcours de creation (specs/wiki-liens-et-personnages.md §B8) :
 * les trois methodes officielles d'attribution des caracteristiques.
 * Tableau standard et tirage partagent la meme UI d'assignation (un bassin
 * fixe de six valeurs a repartir) ; l'achat de points a sa propre UI de
 * curseurs bornes par un budget.
 *
 * L'assignation se fait par INDICE dans le bassin, pas par valeur — un
 * tirage peut produire deux totaux identiques par coincidence (deux 4d6kh3
 * a 13, par exemple), et une assignation par valeur libererait alors les
 * deux emplacements a la fois des qu'on en change un.
 */
export default function AbilityScoreStep({
  character,
  patchCharacter,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
}) {
  const [rolledPool, setRolledPool] = useState<number[] | null>(null);
  const [assignment, setAssignment] = useState<Partial<Record<Ability, number>>>({});
  const [rolling, setRolling] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);

  const method = character.abilities.method;
  const pool = method === "standard_array" ? [...STANDARD_ARRAY] : method === "roll" ? rolledPool : null;

  function setMethod(next: CharacterBlockData["abilities"]["method"]) {
    setAssignment({});
    setRolledPool(null);
    patchCharacter({
      abilities: { method: next, base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    });
  }

  function assignFromPool(ability: Ability, poolIndex: number | null, poolValues: number[]) {
    const next = { ...assignment, [ability]: poolIndex ?? undefined };
    setAssignment(next);
    const base: AbilityScores = { ...character.abilities.base };
    for (const a of ABILITIES) {
      const idx = next[a];
      base[a] = idx !== undefined ? poolValues[idx] : 10;
    }
    patchCharacter({ abilities: { ...character.abilities, base } });
  }

  async function rollAbilities() {
    setRolling(true);
    setRollError(null);
    try {
      const res = await fetch("/api/character-creator/roll-abilities", { method: "POST" });
      if (!res.ok) {
        setRollError("Le tirage a échoué — réessayez.");
        return;
      }
      const body: { rolls: number[] } = await res.json();
      setRolledPool(body.rolls);
      setAssignment({});
      patchCharacter({ abilities: { ...character.abilities, base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } } });
    } finally {
      setRolling(false);
    }
  }

  function setPointBuyScore(ability: Ability, score: number) {
    patchCharacter({ abilities: { ...character.abilities, base: { ...character.abilities.base, [ability]: score } } });
  }

  const spentPoints = method === "point_buy" ? pointBuyCost(character.abilities.base) : 0;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
        Méthode
        <Dropdown
          value={method}
          options={[
            { value: "standard_array", label: "Tableau standard (15/14/13/12/10/8)" },
            { value: "point_buy", label: "Achat de points (27 points)" },
            { value: "roll", label: "Tirage (4d6, on garde les 3 meilleurs)" },
          ]}
          onChange={(v) => setMethod(v as CharacterBlockData["abilities"]["method"])}
          aria-label="Méthode d'attribution des caractéristiques"
        />
      </label>

      {method === "roll" && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={rollAbilities}
            disabled={rolling}
            className="rounded-full border border-edge px-3 py-1.5 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            {rolledPool ? "Relancer les dés" : "Lancer les dés"}
          </button>
          {rollError && <span className="text-xs text-danger">{rollError}</span>}
        </div>
      )}

      {(method === "standard_array" || method === "roll") && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {ABILITIES.map((ability) => {
            const currentIdx = assignment[ability];
            // Un indice deja pris par une AUTRE caracteristique disparait de
            // ce menu (une seule caracteristique par valeur du bassin) — sans
            // ce filtre, rien n'empechait d'assigner 15 a la fois a FOR et
            // DEX, un bug reel trouve en verifiant l'assistant en navigateur.
            const usedByOthers = new Set(
              ABILITIES.filter((a) => a !== ability && assignment[a] !== undefined).map((a) => assignment[a])
            );
            const options = pool
              ? [
                  { value: "", label: "—" },
                  ...pool
                    .map((value, idx) => ({ value: String(idx), label: `${value} (${formatMod(value)})`, idx }))
                    .filter((o) => !usedByOthers.has(o.idx)),
                ]
              : [{ value: "", label: "Tirez d'abord les dés" }];
            return (
              <label key={ability} className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-ink-muted">
                {ABILITY_LABELS[ability]}
                <Dropdown
                  value={currentIdx !== undefined ? String(currentIdx) : ""}
                  options={options}
                  onChange={(v) => pool && assignFromPool(ability, v === "" ? null : Number(v), pool)}
                  aria-label={`Valeur de ${ABILITY_LABELS[ability]}`}
                />
              </label>
            );
          })}
        </div>
      )}

      {method === "point_buy" && (
        <div className="flex flex-col gap-3">
          <p className={`text-xs ${spentPoints > POINT_BUY_BUDGET ? "text-danger" : "text-ink-muted"}`}>
            {spentPoints}/{POINT_BUY_BUDGET} points dépensés
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ABILITIES.map((ability) => {
              const score = character.abilities.base[ability];
              return (
                <div key={ability} className="flex flex-col items-center gap-1 rounded-lg border border-edge/60 bg-panel-raised px-2 py-2.5 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{ABILITY_LABELS[ability]}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={score <= POINT_BUY_MIN}
                      onClick={() => setPointBuyScore(ability, score - 1)}
                      className="rounded-full border border-edge px-2 text-sm hover:bg-panel disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-xl font-bold text-ink">{score}</span>
                    <button
                      type="button"
                      disabled={score >= POINT_BUY_MAX || pointBuyCost({ ...character.abilities.base, [ability]: score + 1 }) > POINT_BUY_BUDGET}
                      onClick={() => setPointBuyScore(ability, score + 1)}
                      className="rounded-full border border-edge px-2 text-sm hover:bg-panel disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-ink-muted">{formatMod(score)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
