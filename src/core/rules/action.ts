import type { Rng } from "../dice/rng";
import type { FormulaNode } from "../formula/ast";
import { evaluate, type TraceStep } from "../formula/evaluate";
import { formatFormulaNode } from "../formula/format";
import { parseFormula } from "../formula/parser";
import type { BonusDie } from "./sheet";

/** V3.1-156 (ADR 0074) : les dés de bonus de la fiche, ajoutés à l'arbre du jet — lancés par le serveur, gardés au détail et dans l'historique. */
function withBonusDice(ast: FormulaNode, dice: readonly BonusDie[] | undefined): FormulaNode {
  let out = ast;
  for (const d of dice ?? []) out = { op: "add", args: [out, { op: "dice", count: d.count, faces: d.faces }] };
  return out;
}

/**
 * `resolveAction` (specs/fiche-personnage-interactive.md §2, specs/regles-couche.md
 * §4.5) : le moteur derriere les boutons d'attaque/degats de la fiche
 * jouable (V1-B5). Malgre ce que la spec affirme, ce module n'existait pas
 * avant ce ticket — verifie par grep avant d'ecrire quoi que ce soit.
 *
 * Perimetre volontairement etroit : jet d'attaque (d20 + modificateurs,
 * avantage/desavantage), jet de degats (formule + modificateur, critique),
 * et jet de test/sauvegarde/initiative (V2-M11, volet de lancer de des —
 * meme d20+modificateur qu'une attaque mais jamais de critique, RAW 5e
 * 2024 ne prevoit pas de reussite/echec critique sur un simple test). Un
 * systeme d'"intentions" generique pour toute action imaginable serait une
 * abstraction pour un besoin qui n'existe pas encore — ces fonctions
 * couvrent exactement ce que V1-B5/V2-M11 affichent.
 */

export type AdvantageState = "normal" | "advantage" | "disadvantage";

export interface AttackRollInput {
  abilityMod: number;
  proficiencyBonus: number;
  proficient: boolean;
  /** Bonus fixe supplementaire (arme magique, etc.), 0 par defaut. */
  bonus?: number;
  advantage: AdvantageState;
  /** V3.1-156 : dés de bonus de la fiche (Bénédiction). */
  bonusDice?: readonly BonusDie[];
  /** V3.1-156 : le plus petit d20 naturel qui fait un critique (20 par défaut). */
  critRange?: number;
}

export interface AttackRollResult {
  total: number;
  isCritical: boolean;
  isCriticalFail: boolean;
  trace: TraceStep[];
  /** Pour la persistance dans `dice_rolls` (ast/expression, SCHEMA.md §14) — jamais recalcule a partir du texte. */
  ast: FormulaNode;
  expression: string;
}

function d20Notation(advantage: AdvantageState): string {
  if (advantage === "advantage") return "2d20kh1";
  if (advantage === "disadvantage") return "2d20kl1";
  return "1d20";
}

/**
 * Jet d'attaque : un d20 (normal, avantage ou desavantage — jamais empiles,
 * cf. specs/wiki-liens-et-personnages.md §B4) plus modificateurs.
 */
export function resolveAttackRoll(input: AttackRollInput, rng: Rng): AttackRollResult {
  const modifier = input.abilityMod + (input.proficient ? input.proficiencyBonus : 0) + (input.bonus ?? 0);
  const ast = withBonusDice(parseFormula(`${d20Notation(input.advantage)} + {mod}`), input.bonusDice);
  const { value, trace } = evaluate(ast, { mod: modifier }, rng, "roll");
  // Le de d20 (garde=1 dans les deux cas d'avantage/desavantage) est
  // toujours le premier pas de trace, avant le modificateur : sa valeur EST
  // le naturel obtenu, structure fixe garantie par le gabarit ci-dessus.
  const natural = trace[0]?.value ?? 0;
  return {
    total: value,
    isCritical: natural >= (input.critRange ?? 20),
    isCriticalFail: natural === 1,
    trace,
    ast,
    expression: formatFormulaNode(ast),
  };
}

export interface CheckRollInput {
  /** Somme deja faite des `sources` de `sheet.ts` (caracteristique + maitrise/expertise le cas echeant) — ce module ne connait rien de leur provenance. */
  modifier: number;
  advantage: AdvantageState;
  /** V3.1-156 : dés de bonus de la fiche (Bénédiction sur une sauvegarde). */
  bonusDice?: readonly BonusDie[];
}

export interface CheckRollResult {
  total: number;
  trace: TraceStep[];
  ast: FormulaNode;
  expression: string;
}

/**
 * Test de caracteristique, de competence, sauvegarde ou initiative : meme
 * d20+modificateur qu'une attaque (`resolveAttackRoll`), jamais de
 * critique — distinct malgre la ressemblance plutot que de forcer l'appelant
 * a ignorer `isCritical`/`isCriticalFail`, qui n'ont pas de sens ici.
 */
export function resolveCheckRoll(input: CheckRollInput, rng: Rng): CheckRollResult {
  const ast = withBonusDice(parseFormula(`${d20Notation(input.advantage)} + {mod}`), input.bonusDice);
  const { value, trace } = evaluate(ast, { mod: input.modifier }, rng, "roll");
  return { total: value, trace, ast, expression: formatFormulaNode(ast) };
}

export interface DamageRollInput {
  /** Ex. "1d6", ou une formule composee comme "1d6+1d4" (sort a plusieurs sources de degats). */
  formula: string;
  abilityMod?: number;
  bonus?: number;
  /** Double le NOMBRE de des, jamais le modificateur — regle standard. */
  critical: boolean;
  /** V3.1-156 : dés de bonus de la fiche ; doublés au critique comme les autres dés. */
  bonusDice?: readonly BonusDie[];
}

export interface DamageRollResult {
  total: number;
  trace: TraceStep[];
  ast: FormulaNode;
  expression: string;
}

function doubleDiceCounts(node: FormulaNode): FormulaNode {
  switch (node.op) {
    case "dice":
      // V3.1-155 : un nombre de dés en formule se double aussi (Attaque sournoise au critique).
      return { ...node, count: typeof node.count === "number" ? node.count * 2 : { op: "mul", args: [node.count, { op: "num", value: 2 }] } };
    case "num":
    case "ref":
      return node;
    case "add":
    case "sub":
    case "mul":
    case "div":
      return { ...node, args: [doubleDiceCounts(node.args[0]), doubleDiceCounts(node.args[1])] };
    case "min":
    case "max":
      return { ...node, args: node.args.map(doubleDiceCounts) };
    case "floor":
    case "ceil":
    case "round":
      return { ...node, args: [doubleDiceCounts(node.args[0])] };
  }
}

/** Jet de degats : la formule fournie (double sur critique), plus un modificateur fixe hors des des. */
export function resolveDamageRoll(input: DamageRollInput, rng: Rng): DamageRollResult {
  let ast = withBonusDice(parseFormula(input.formula), input.bonusDice);
  if (input.critical) ast = doubleDiceCounts(ast);

  const flatBonus = (input.abilityMod ?? 0) + (input.bonus ?? 0);
  if (flatBonus === 0) {
    const { value, trace } = evaluate(ast, {}, rng, "roll");
    return { total: value, trace, ast, expression: formatFormulaNode(ast) };
  }
  const withBonus: FormulaNode = { op: "add", args: [ast, { op: "ref", name: "mod" }] };
  const { value, trace } = evaluate(withBonus, { mod: flatBonus }, rng, "roll");
  return { total: value, trace, ast: withBonus, expression: formatFormulaNode(withBonus) };
}

/**
 * Caracteristique utilisee pour une attaque d'arme (regle standard) : Dex
 * pour une arme a distance, le meilleur de Force/Dex si `finesse`, Force
 * sinon.
 */
export function weaponAttackAbilityMod(
  properties: readonly string[],
  isRanged: boolean,
  strMod: number,
  dexMod: number,
): number {
  if (isRanged) return dexMod;
  if (properties.includes("finesse")) return Math.max(strMod, dexMod);
  return strMod;
}

/** V3.1-156 : la caractéristique de l'attaque d'arme (même règle que `weaponAttackAbilityMod`) — `damage.weapon.str` (la Rage) en dépend. */
export function weaponAttackAbility(properties: readonly string[], isRanged: boolean, strMod: number, dexMod: number): "str" | "dex" {
  if (isRanged) return "dex";
  if (properties.includes("finesse")) return dexMod > strMod ? "dex" : "str";
  return "str";
}

/** V3.1-156 : l'avantage choisi au jet et celui que donne la fiche s'annulent s'ils s'opposent, jamais ne s'empilent. */
export function combineAdvantage(choisi: AdvantageState, fiche: AdvantageState): AdvantageState {
  if (fiche === "normal") return choisi;
  if (choisi === "normal") return fiche;
  return choisi === fiche ? choisi : "normal";
}
