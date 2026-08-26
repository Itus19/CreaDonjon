"use client";

import { useState } from "react";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { AbilityScores } from "@/src/core/schemas/blocks/abilities";
import type { Ability, DerivedSheet } from "@/src/core/rules/sheet";
import { POINT_BUY_BUDGET, POINT_BUY_MAX, POINT_BUY_MIN, STANDARD_ARRAY, pointBuyCost } from "@/src/core/rules/abilityGeneration";
import Dropdown from "@/components/shared/Dropdown";
import Stepper from "@/components/shared/Stepper";
import { StatBadge } from "@/components/blocks/CharacterSheetHeader";

const ABILITY_LABELS: Record<Ability, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };
const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function modifierOf(score: number): number {
  return Math.floor((score - 10) / 2);
}

function formatSigned(mod: number): string {
  return `${mod >= 0 ? "+" : ""}${mod}`;
}

function formatMod(score: number): string {
  return formatSigned(modifierOf(score));
}

export interface AbilityPoolAssignment {
  rolledPool: number[] | null;
  assignment: Partial<Record<Ability, number>>;
}

export const EMPTY_ABILITY_POOL_ASSIGNMENT: AbilityPoolAssignment = { rolledPool: null, assignment: {} };

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
 *
 * `pool`/`onChangePool` sont controles par le parent (pas un `useState` ici)
 * — ce composant est demonte/remonte a chaque changement d'etape du wizard
 * (`{step === 2 && <AbilityScoreStep/>}`), un etat local y serait perdu a
 * chaque aller-retour meme si `character.abilities.base` reste correct
 * (bug reel trouve en verifiant l'assistant en navigateur).
 */
export default function AbilityScoreStep({
  character,
  patchCharacter,
  pool: poolState,
  onChangePool,
  sheet,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  pool: AbilityPoolAssignment;
  onChangePool: (next: AbilityPoolAssignment) => void;
  sheet: DerivedSheet;
}) {
  const [rolling, setRolling] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);

  const method = character.abilities.method;
  const pool = method === "standard_array" ? [...STANDARD_ARRAY] : method === "roll" ? poolState.rolledPool : null;

  function setMethod(next: CharacterBlockData["abilities"]["method"]) {
    onChangePool(EMPTY_ABILITY_POOL_ASSIGNMENT);
    patchCharacter({
      abilities: { method: next, base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    });
  }

  function assignFromPool(ability: Ability, poolIndex: number | null, poolValues: number[]) {
    const nextAssignment = { ...poolState.assignment, [ability]: poolIndex ?? undefined };
    onChangePool({ ...poolState, assignment: nextAssignment });
    const base: AbilityScores = { ...character.abilities.base };
    for (const a of ABILITIES) {
      const idx = nextAssignment[a];
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
      onChangePool({ rolledPool: body.rolls, assignment: {} });
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
            {poolState.rolledPool ? "Relancer les dés" : "Lancer les dés"}
          </button>
          {rollError && <span className="text-xs text-danger">{rollError}</span>}
        </div>
      )}

      {(method === "standard_array" || method === "roll") && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {ABILITIES.map((ability) => {
            const currentIdx = poolState.assignment[ability];
            // Un indice deja pris par une AUTRE caracteristique disparait de
            // ce menu (une seule caracteristique par valeur du bassin) — sans
            // ce filtre, rien n'empechait d'assigner 15 a la fois a FOR et
            // DEX, un bug reel trouve en verifiant l'assistant en navigateur.
            const usedByOthers = new Set(
              ABILITIES.filter((a) => a !== ability && poolState.assignment[a] !== undefined).map((a) => poolState.assignment[a])
            );
            const options = pool
              ? [
                  { value: "", label: "—" },
                  ...pool
                    .map((value, idx) => ({ value: String(idx), label: `${value} (${formatMod(value)})`, idx }))
                    .filter((o) => !usedByOthers.has(o.idx)),
                ]
              : [{ value: "", label: "Tirez d'abord les dés" }];
            const score = currentIdx !== undefined && pool ? pool[currentIdx] : null;
            return (
              <div key={ability} className="flex flex-col items-center gap-1 rounded-lg border border-edge/60 bg-panel-raised px-2 py-2.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{ABILITY_LABELS[ability]}</span>
                <Dropdown
                  value={currentIdx !== undefined ? String(currentIdx) : ""}
                  options={options}
                  onChange={(v) => pool && assignFromPool(ability, v === "" ? null : Number(v), pool)}
                  aria-label={`Valeur de ${ABILITY_LABELS[ability]}`}
                />
                <span className="text-xs text-ink-muted">{score !== null ? formatMod(score) : "—"}</span>
                <span className="text-[10px] text-ink-muted">Sauv. {formatSigned(sheet.savingThrows[ability].mod)}</span>
              </div>
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
                  <Stepper
                    onIncrement={() => setPointBuyScore(ability, score + 1)}
                    onDecrement={() => setPointBuyScore(ability, score - 1)}
                    incrementDisabled={
                      score >= POINT_BUY_MAX || pointBuyCost({ ...character.abilities.base, [ability]: score + 1 }) > POINT_BUY_BUDGET
                    }
                    decrementDisabled={score <= POINT_BUY_MIN}
                    incrementLabel={`Augmenter ${ABILITY_LABELS[ability]}`}
                    decrementLabel={`Diminuer ${ABILITY_LABELS[ability]}`}
                    className="h-12 w-14"
                  >
                    <span className="text-xl font-bold text-ink">{score}</span>
                  </Stepper>
                  <span className="text-xs text-ink-muted">{formatMod(score)}</span>
                  <span className="text-[10px] text-ink-muted">Sauv. {formatSigned(sheet.savingThrows[ability].mod)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CA (bouclier) + Initiative/Perception passive, memes composants que
          l'en-tete de la vraie fiche (`CharacterSheetHeader`) — jamais une
          deuxieme presentation. Centres (retour utilisateur, V2-G1) : les
          jets de sauvegarde qui accompagnaient ce bandeau sont montes dans
          chaque encadre de caracteristique ci-dessus, sous le modificateur. */}
      <div className="flex justify-center gap-2 border-t border-edge/60 pt-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <span className="flex h-6 items-end justify-center text-[9px] font-bold uppercase tracking-widest text-ink-muted">CA</span>
          <div
            className="relative flex h-14 w-12 items-center justify-center border-2 border-accent bg-panel-raised"
            style={{ clipPath: "polygon(50% 0%, 100% 20%, 100% 55%, 50% 100%, 0% 55%, 0% 20%)" }}
            title="Classe d'armure — calculée automatiquement (10 + Dex + équipement)"
          >
            <span className="text-xl font-bold text-ink">{sheet.ac.value}</span>
          </div>
        </div>
        <StatBadge label="Initiative" value={formatSigned(sheet.abilities.dex.mod)} />
        <StatBadge label="Perception passive" value={String(10 + sheet.skills.perception.mod)} />
      </div>
    </div>
  );
}
