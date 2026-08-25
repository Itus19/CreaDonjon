import type { FormulaNode } from "../formula/ast";
import { formatFormulaNode } from "../formula/format";
import type { EffectsBlockData, ScalingBlockData } from "../schemas/rule-blocks/blocks";

/**
 * Engendre la table complete de paliers a partir d'un bloc scaling
 * (specs/regles-blocs.md §6). Si `table` est deja presente (cas de
 * l'import SRD : la source enumere deja chaque palier), elle prime telle
 * quelle. Sinon, `rule.per_step` est cumule depuis `base` jusqu'a
 * `maxLevel` sur `baseFormula`.
 *
 * Resoudre `rule.target` (un chemin vers un autre bloc de la meme entree,
 * par exemple le `formula` d'un effet) est la responsabilite de l'appelant :
 * cette fonction ne connait qu'un bloc a la fois, jamais l'ensemble d'une
 * fiche. Sans `baseFormula`, il n'y a rien a engendrer — table vide plutot
 * qu'une erreur, une fiche de regle ne doit jamais planter a l'affichage.
 */
export function generateScalingTable(
  data: ScalingBlockData,
  maxLevel: number,
  baseFormula?: FormulaNode
): Record<string, string> {
  if (data.table) return data.table;
  if (!data.rule || !baseFormula) return {};

  const table: Record<string, string> = {};
  let current = baseFormula;
  for (let level = data.base; level <= maxLevel; level++) {
    if (level > data.base) {
      current = combine(current, data.rule.per_step);
    }
    table[String(level)] = formatFormulaNode(current);
  }
  return table;
}

/**
 * Resout `rule.target` vers la formule qu'il designe dans le bloc effects
 * de la meme entree — la seule forme de cible reellement necessaire
 * aujourd'hui (specs/regles-blocs.md §6 illustre "effects.e1.damage.formula",
 * mais zEffectsBlockData reste plat : `formula` est un champ direct de
 * l'effet, pas niche sous "damage"). Un resolveur de chemin generique
 * n'a pas de second cas concret a couvrir pour l'instant — regle des trois.
 */
export function resolveScalingTarget(
  target: string,
  effectsBlockData: EffectsBlockData | undefined
): FormulaNode | undefined {
  if (!effectsBlockData) return undefined;
  const [blockType, effectId] = target.split(".");
  if (blockType !== "effects") return undefined;
  return effectsBlockData.effects.find((e) => e.id === effectId)?.formula;
}

/**
 * Formule de degats resolue a un palier donne (emplacement pour un sort a
 * emplacement, niveau de personnage pour un tour de magie — meme cle que
 * celle reellement envoyee au serveur au clic, cf. `castSpell`) — partagee
 * entre le serveur (`castSpell`, degats effectivement lances) et le client
 * (bouton de degats de l'onglet Actions, formule affichee AVANT le clic) :
 * une seule implementation, jamais un calcul client qui pourrait diverger
 * du jet reellement effectue.
 */
export function resolveScaledFormulaText(
  scalingData: ScalingBlockData,
  level: number,
  effectsData: EffectsBlockData | undefined,
  baseFormula: FormulaNode
): string {
  const target = scalingData.rule?.target ? resolveScalingTarget(scalingData.rule.target, effectsData) : baseFormula;
  const table = generateScalingTable(scalingData, level, target ?? baseFormula);
  return table[String(level)] ?? formatFormulaNode(baseFormula);
}

/**
 * Fusionne deux termes quand c'est arithmetiquement fidele de le faire
 * (memes des, ou deux nombres) : "8d6" + "1d6" par palier doit s'afficher
 * "9d6", pas "8d6 + 1d6 + 1d6...". Sans point commun, addition explicite.
 */
function combine(a: FormulaNode, b: FormulaNode): FormulaNode {
  if (a.op === "dice" && b.op === "dice" && a.faces === b.faces && !a.keep && !b.keep) {
    return { op: "dice", count: a.count + b.count, faces: a.faces };
  }
  if (a.op === "num" && b.op === "num") {
    return { op: "num", value: a.value + b.value };
  }
  return { op: "add", args: [a, b] };
}
