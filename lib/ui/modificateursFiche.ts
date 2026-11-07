/**
 * V3.1-157 — la valeur d'un modificateur dans le formulaire d'une fiche de
 * règle (bloc `modifiers`) : un champ de FORMULE (`2`, `1d4`, `max(1, {ability.cha})`),
 * jamais du JSON (ADR 0074). Un nombre reste un nombre dans le bloc enregistré.
 *
 * Pur : aucun effet, aucun React.
 */
import { containsDice, formatFormulaNode, FormulaError, parseFormula, type FormulaNode } from "@/src/core/formula";
import type { ModifierOp } from "@/src/core/rules/sheet";
import { isRollTarget } from "@/src/core/schemas/rule-blocks/primitives";
import { zModifiersBlockData } from "@/src/core/schemas/rule-blocks/blocks";

export type ValeurEcrite = { ok: true; value: number | FormulaNode } | { ok: false; erreur: string };

/** La valeur enregistrée vers le texte du champ : « 2 », « 1d4 ». Sans valeur : « 1 » (le défaut du formulaire). */
export function valeurVersTexte(value: number | FormulaNode | undefined): string {
  if (value === undefined) return "1";
  return typeof value === "number" ? String(value) : formatFormulaNode(value);
}

/** Le texte du champ vers la valeur enregistrée, ou pourquoi il n'est pas acceptable (formule fausse, dé sur une cible fixe). */
export function texteVersValeur(texte: string, cible: string): ValeurEcrite {
  if (texte.trim() === "") return { ok: false, erreur: "Formule vide." };
  let noeud: FormulaNode;
  try {
    noeud = parseFormula(texte);
  } catch (erreur) {
    if (erreur instanceof FormulaError) return { ok: false, erreur: erreur.message };
    throw erreur;
  }
  if (containsDice(noeud) && !isRollTarget(cible)) {
    return { ok: false, erreur: "Un dé ne s'ajoute qu'à un jet (attaque, dégâts, sauvegarde, test) : pas à cette cible." };
  }
  return { ok: true, value: noeud.op === "num" ? noeud.value : noeud };
}

export interface ModificateurDeFiche {
  target: string;
  op: ModifierOp;
  /** Le texte du champ de valeur. */
  value: string;
}

/**
 * Les modificateurs d'une fiche relue, pour pré-remplir le formulaire. Le noyau
 * (`featureFormValues`) rend `String(value)`, qui écrirait « [object Object] »
 * pour une formule : la lecture se fait donc ici.
 */
export function modificateursDeLaFiche(blocks: readonly { blockType: string; data: unknown }[]): ModificateurDeFiche[] {
  const bloc = blocks.find((b) => b.blockType === "modifiers");
  const lu = zModifiersBlockData.safeParse(bloc?.data);
  return lu.success ? lu.data.modifiers.map((m) => ({ target: m.target, op: m.op, value: valeurVersTexte(m.value) })) : [];
}
