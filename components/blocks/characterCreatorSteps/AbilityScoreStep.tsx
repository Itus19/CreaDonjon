"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { Ability, DerivedSheet } from "@/src/core/rules/sheet";
import { pointBuyCost } from "@/src/core/rules/characterRules";
import type { CharacterRules } from "@/src/core/schemas/rule-blocks/characterRules";
import Stepper from "@/components/shared/Stepper";
import { StatBadge } from "@/components/blocks/CharacterSheetHeader";
import { ABILITY_LABELS } from "@/components/blocks/sheetLabels";
import { echangerValeurs, peutAugmenter, peutDiminuer, repartirSelonPriorite, type Valeurs } from "@/lib/ui/caracteristiques";

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];
const VALEURS_PAR_DEFAUT: Valeurs = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

type Methode = CharacterBlockData["abilities"]["method"];

function signe(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

/** Les deux listes contiennent-elles les mêmes valeurs, dans un ordre quelconque ? */
function memesValeurs(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const triA = [...a].sort((x, y) => x - y);
  const triB = [...b].sort((x, y) => x - y);
  return triA.every((v, i) => v === triB[i]);
}

export interface AbilityPoolAssignment {
  rolledPool: number[] | null;
  assignment: Partial<Record<Ability, number>>;
}

export const EMPTY_ABILITY_POOL_ASSIGNMENT: AbilityPoolAssignment = { rolledPool: null, assignment: {} };

/**
 * Étape « Caractéristiques » du parcours de création (V3.1-52).
 *
 * Trois méthodes, seulement celles que le ruleset propose (V3.1-115, ADR 0046) :
 * tableau standard, achat de points, tirage. Les valeurs, le budget, les coûts
 * et le plafond viennent de `characterRules`, jamais d'une constante.
 *
 * Tableau standard et tirage : « Répartir pour un <classe> » place les valeurs
 * selon l'ordre de la classe, puis on touche deux cases pour échanger leurs
 * valeurs. Le tirage est fait par le serveur (règle 8), jamais ici.
 * Achat de points : − / + par case, grisés au budget ou au plafond.
 *
 * Les six grandes cases lisent le total, le modificateur et ses sources dans
 * la fiche du moteur (`sheet.abilities`) : rien ne se recalcule ici. Le bonus
 * d'historique et les améliorations de niveau y sont montrés, réglés ailleurs.
 *
 * `pool` (le tirage obtenu) reste contrôlé par le parent : l'étape est démontée
 * à chaque changement d'étape de l'assistant, un état local y serait perdu.
 */
export default function AbilityScoreStep({
  character,
  patchCharacter,
  pool: poolState,
  onChangePool,
  sheet,
  characterRules,
  worldSlug,
  rulesLoaded,
  classLabel,
  suggestedAbilities,
}: {
  character: CharacterBlockData;
  patchCharacter: (fields: Partial<CharacterBlockData>) => void;
  pool: AbilityPoolAssignment;
  onChangePool: (next: AbilityPoolAssignment) => void;
  sheet: DerivedSheet;
  /** Règles de personnage du ruleset résolu ; `undefined` si le ruleset n'en a pas. */
  characterRules: CharacterRules | undefined;
  /** Monde dont le ruleset dicte le tirage (la route de tirage lit les règles côté serveur). */
  worldSlug: string;
  /** Le ruleset résolu est-il arrivé ? Avant l'espèce/la classe, ou pendant le chargement, son absence n'est pas « pas de règles ». */
  rulesLoaded: boolean;
  /** Nom de la première classe choisie ; absent tant qu'aucune n'est choisie. */
  classLabel?: string;
  /** Ordre de la classe, lu dans le ruleset (`suggestedAbilities`) ; absent : ordre FOR → CHA. */
  suggestedAbilities?: readonly Ability[];
}) {
  const t = useTranslations("creation.carac");
  const [rolling, setRolling] = useState(false);
  const rollingRef = useRef(false);
  const [rollError, setRollError] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<Ability | null>(null);

  const generation = characterRules?.ability_generation;
  const cap = characterRules?.ability_score_cap;
  const standardArray = generation?.standard_array;
  const pointBuy = generation?.point_buy;
  const rollRule = generation?.roll;
  const offeredMethods: Methode[] = [
    ...(standardArray ? (["standard_array"] as const) : []),
    ...(pointBuy ? (["point_buy"] as const) : []),
    ...(rollRule ? (["roll"] as const) : []),
  ];
  // Une méthode enregistrée mais absente des règles n'est pas la méthode active : l'utilisatrice doit en choisir une.
  const method = offeredMethods.includes(character.abilities.method) ? character.abilities.method : null;
  const base: Valeurs = character.abilities.base;
  const pool = method === "standard_array" ? (standardArray ?? null) : method === "roll" ? poolState.rolledPool : null;
  /** Les valeurs du bassin sont-elles déjà posées sur les cases (suggestion faite) ? Alors on peut les échanger. */
  const reparti = pool !== null && memesValeurs(pool, Object.values(base));
  const overCapValues = pool && cap !== undefined ? pool.filter((v) => v > cap) : [];

  function setBase(next: Valeurs) {
    patchCharacter({ abilities: { ...character.abilities, base: next } });
  }

  function setMethod(next: Methode) {
    if (next === method) return;
    setMarquee(null);
    setRollError(null);
    onChangePool(EMPTY_ABILITY_POOL_ASSIGNMENT);
    patchCharacter({ abilities: { method: next, base: { ...VALEURS_PAR_DEFAUT } } });
  }

  function repartir(valeurs: readonly number[]) {
    setMarquee(null);
    setBase(repartirSelonPriorite(valeurs, suggestedAbilities ?? []));
  }

  /** Premier toucher : la case est marquée ; second : échange ; la même case : annule. */
  function toucher(ability: Ability) {
    if (marquee === null) {
      setMarquee(ability);
      return;
    }
    if (marquee !== ability) setBase(echangerValeurs(base, marquee, ability));
    setMarquee(null);
  }

  async function lancerLesDes() {
    // Pas de `disabled` : le bouton a le focus, le perdre sauverait la carte du bloc. Un garde suffit.
    if (rollingRef.current) return;
    rollingRef.current = true;
    setRolling(true);
    setRollError(null);
    try {
      const res = await fetch("/api/character-creator/roll-abilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldSlug }),
      });
      if (!res.ok) {
        const corps: { error?: string } | null = await res.json().catch(() => null);
        setRollError(corps?.error ?? t("tirageEchec"));
        return;
      }
      const corps: { rolls: number[] } = await res.json();
      onChangePool({ rolledPool: corps.rolls, assignment: {} });
      setMarquee(null);
      setBase(repartirSelonPriorite(corps.rolls, suggestedAbilities ?? []));
    } catch {
      setRollError(t("tirageEchec"));
    } finally {
      rollingRef.current = false;
      setRolling(false);
    }
  }

  const depense = method === "point_buy" && pointBuy ? pointBuyCost(base, pointBuy) : 0;

  if (!characterRules) {
    return <p className="text-sm text-ink-muted">{rulesLoaded ? t("sansRegles") : t("choisirDAbord")}</p>;
  }
  if (offeredMethods.length === 0) {
    return <p className="text-sm text-ink-muted">{t("aucuneMethode")}</p>;
  }

  const nomMethode = (m: Methode): string => {
    if (m === "standard_array") return t("methode.tableau");
    if (m === "point_buy") return t("methode.achat");
    return t("methode.tirage");
  };
  const detailMethode = (m: Methode): string => {
    if (m === "standard_array" && standardArray) return standardArray.join("/");
    if (m === "point_buy" && pointBuy) return t("detail.achat", { budget: pointBuy.budget });
    if (m === "roll" && rollRule) {
      return rollRule.keep_highest === rollRule.dice_count
        ? t("detail.tirage", { des: rollRule.dice_count, faces: rollRule.dice_faces })
        : t("detail.tirageGarde", { des: rollRule.dice_count, faces: rollRule.dice_faces, garde: rollRule.keep_highest });
    }
    return "";
  };

  /** Contenu d'une grande case : tout vient de la fiche du moteur. */
  function contenuCase(ability: Ability) {
    const r = sheet.abilities[ability];
    return (
      <>
        <span className="text-xs font-bold uppercase tracking-widest text-accent">{ABILITY_LABELS[ability]}</span>
        <span className="text-3xl font-bold leading-none text-ink">{r.score}</span>
        <span className="text-sm text-ink-soft">{signe(r.mod)}</span>
        <span className="flex flex-col items-center text-xs text-ink-muted">
          {r.sources.map((s, i) => (
            <span key={`${s.label}:${i}`}>{i === 0 ? t("source.base", { label: s.label, valeur: s.value }) : t("source.ajout", { label: s.label, valeur: signe(s.value) })}</span>
          ))}
        </span>
      </>
    );
  }

  const classeCase = "flex flex-col items-center gap-1 rounded-lg border bg-panel-raised px-2 py-3 text-center";

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t("methodeAria")} className="flex flex-wrap gap-2">
        {offeredMethods.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={method === m}
            onClick={() => setMethod(m)}
            className={`flex flex-col items-start rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${
              method === m ? "border-accent bg-panel-raised text-ink" : "border-edge text-ink-soft hover:bg-panel-raised"
            }`}
          >
            <span>{nomMethode(m)}</span>
            <span className="text-xs text-ink-muted">{detailMethode(m)}</span>
          </button>
        ))}
      </div>

      {method === null && <p className="text-sm text-ink-muted">{t("choisirMethode")}</p>}

      {method === "roll" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={lancerLesDes}
            aria-disabled={rolling}
            className={`rounded-full border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised ${rolling ? "opacity-50" : ""}`}
          >
            {rolling ? t("tirageEnCours") : poolState.rolledPool ? t("relancer") : t("lancer")}
          </button>
          {poolState.rolledPool && <span className="text-sm text-ink-muted">{t("tirageObtenu", { valeurs: poolState.rolledPool.join(", ") })}</span>}
          {rollError && (
            <span role="alert" className="text-sm text-danger">
              {rollError}
            </span>
          )}
        </div>
      )}

      {pool && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => repartir(pool)}
            className="rounded-full border border-edge px-3 py-1.5 text-sm text-ink transition-colors hover:bg-panel-raised"
          >
            {classLabel ? t("repartirPour", { classe: classLabel.toLowerCase() }) : t("repartir")}
          </button>
          {classLabel && suggestedAbilities && suggestedAbilities.length > 0 && (
            <span className="text-sm text-ink-muted">{t("ordreClasse", { ordre: suggestedAbilities.map((a) => ABILITY_LABELS[a]).join(" › ") })}</span>
          )}
          {!classLabel && <span className="text-sm text-ink-muted">{t("sansClasse")}</span>}
        </div>
      )}

      {overCapValues.length > 0 && (
        <p role="alert" className="text-sm text-danger">
          {t("auDessusPlafond", { plafond: cap ?? 0, valeurs: overCapValues.join(", ") })}
        </p>
      )}

      {pool && !reparti && <p className="text-sm text-ink-muted">{method === "roll" && !poolState.rolledPool ? t("lancerDAbord") : t("pasEncoreReparti")}</p>}
      {pool && reparti && <p className="text-sm text-ink-muted">{t("aideEchange")}</p>}

      {method === "point_buy" && pointBuy && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">{t("budget")}</span>
            <span className={depense > pointBuy.budget ? "text-danger" : "text-ink"}>{t("depense", { depense, budget: pointBuy.budget })}</span>
          </div>
          <div
            role="progressbar"
            aria-label={t("budget")}
            aria-valuemin={0}
            aria-valuemax={pointBuy.budget}
            aria-valuenow={depense}
            className="h-2 overflow-hidden rounded-full bg-panel-sunken"
          >
            <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, (depense / pointBuy.budget) * 100)}%` }} />
          </div>
        </div>
      )}

      {method !== null && (
        <div className="grid grid-cols-2 gap-3 @lg/creation:grid-cols-3 @2xl/creation:grid-cols-6">
          {ABILITIES.map((ability) => {
            if (method === "point_buy" && pointBuy) {
              return (
                <div key={ability} className={`${classeCase} border-edge/60`}>
                  <Stepper
                    onIncrement={() => setBase({ ...base, [ability]: base[ability] + 1 })}
                    onDecrement={() => setBase({ ...base, [ability]: base[ability] - 1 })}
                    incrementDisabled={!peutAugmenter(base, ability, pointBuy) || (cap !== undefined && base[ability] + 1 > cap)}
                    decrementDisabled={!peutDiminuer(base, ability, pointBuy)}
                    incrementLabel={t("augmenter", { carac: ABILITY_LABELS[ability] })}
                    decrementLabel={t("diminuer", { carac: ABILITY_LABELS[ability] })}
                    className="w-full"
                  >
                    <span className="flex flex-col items-center gap-1 py-1">{contenuCase(ability)}</span>
                  </Stepper>
                </div>
              );
            }
            const marquee_ = marquee === ability;
            return (
              <button
                key={ability}
                type="button"
                disabled={!reparti}
                aria-pressed={marquee_}
                aria-label={t("caseAria", { carac: ABILITY_LABELS[ability], valeur: sheet.abilities[ability].score })}
                onClick={() => toucher(ability)}
                className={`${classeCase} transition-colors disabled:cursor-default ${marquee_ ? "border-accent ring-1 ring-accent" : "border-edge/60"} ${reparti ? "hover:bg-panel-sunken" : ""}`}
              >
                {contenuCase(ability)}
              </button>
            );
          })}
        </div>
      )}

      {method !== null && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs text-ink-muted @lg/creation:grid-cols-6">
          {ABILITIES.map((ability) => (
            <span key={ability}>{t("sauvegarde", { carac: ABILITY_LABELS[ability], mod: signe(sheet.savingThrows[ability].mod) })}</span>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-2 border-t border-edge/60 pt-3">
        <StatBadge label={t("ca")} value={String(sheet.ac.value)} />
        <StatBadge label={t("initiative")} value={signe(sheet.abilities.dex.mod)} />
        <StatBadge label={t("perceptionPassive")} value={String(10 + sheet.skills.perception.mod)} />
      </div>
    </div>
  );
}
