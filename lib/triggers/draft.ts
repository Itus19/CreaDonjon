import type { ConditionNode, EffectNode, Trigger, TriggerEvent } from "@/src/core/rules/triggers";
import type { BudgetKind } from "@/src/core/rules/actionBudget";

/**
 * V3-A5 — Traduction « ce que l'auteur a rempli » → `Trigger`.
 *
 * Fonction PURE, hors du composant, parce que c'est la seule logique du
 * formulaire qui puisse se tromper en silence : une condition mal composee
 * produit un declencheur valide au sens de Zod mais qui ne part jamais, et
 * aucun typage ne le verrait.
 *
 * **Ce formulaire ne couvre pas tout le vocabulaire, volontairement.** Les
 * conditions se limitent a trois formes et les effets a six — celles qui
 * couvrent les regles maison ordinaires. Une regle comme la concentration
 * (un jet de sauvegarde avec sa branche d'echec) demande l'AST complet :
 * elle se saisit en JSON dans le bac a sable, puis se colle dans la fiche.
 * Construire un editeur d'AST generique pour trois cas qui n'existent pas
 * encore serait exactement l'abstraction que ce projet refuse.
 */

export type ConditionKind = "aucune" | "condition" | "etiquette" | "donnee";
export type EffectKind =
  | "narrate_hint"
  | "apply_condition"
  | "remove_condition"
  | "heal"
  | "deal_damage"
  | "grant_budget";

export interface TriggerDraft {
  event: TriggerEvent;
  conditionKind: ConditionKind;
  /** Clé de condition, étiquette, ou nom de donnée selon `conditionKind`. */
  conditionKey: string;
  /** Seuil, pour `conditionKind === "donnee"` seulement. */
  conditionMin: string;
  effectKind: EffectKind;
  /** Texte (`narrate_hint`) ou clé de condition, selon `effectKind`. */
  effectText: string;
  effectAmount: string;
  budgetKind: BudgetKind;
}

export function emptyDraft(): TriggerDraft {
  return {
    event: "check_failed",
    conditionKind: "etiquette",
    conditionKey: "",
    conditionMin: "1",
    effectKind: "narrate_hint",
    effectText: "",
    effectAmount: "1",
    budgetKind: "bonus",
  };
}

/** `who: "self"` partout : au moment de la saisie, le porteur de la regle est le seul acteur connu. */
const SELF = "self";

function conditionFrom(draft: TriggerDraft): ConditionNode | undefined {
  const key = draft.conditionKey.trim();
  if (draft.conditionKind === "aucune" || key === "") return undefined;

  if (draft.conditionKind === "condition") return { op: "has_condition", who: SELF, key };
  if (draft.conditionKind === "etiquette") return { op: "event_has", key };

  // Le nom saisi est prefixe `event.` s'il ne l'est pas deja : c'est
  // l'espace de noms des donnees d'evenement, et l'auteur n'a aucune raison
  // de connaitre ce detail d'encodage.
  const name = key.startsWith("event.") ? key : `event.${key}`;
  return {
    op: "gte",
    args: [
      { op: "ref", name },
      { op: "num", value: Number(draft.conditionMin) || 0 },
    ],
  };
}

function effectFrom(draft: TriggerDraft): EffectNode | null {
  const text = draft.effectText.trim();
  const amount = Number(draft.effectAmount) || 0;

  switch (draft.effectKind) {
    case "narrate_hint":
      return text === "" ? null : { action: "narrate_hint", text };
    case "apply_condition":
      return text === "" ? null : { action: "apply_condition", who: SELF, key: text };
    case "remove_condition":
      return text === "" ? null : { action: "remove_condition", who: SELF, key: text };
    case "heal":
      return { action: "heal", who: SELF, amount: { op: "num", value: amount } };
    case "deal_damage":
      return { action: "deal_damage", who: SELF, amount: { op: "num", value: amount } };
    case "grant_budget":
      return { action: "grant_budget", who: SELF, kind: draft.budgetKind, amount: { op: "num", value: amount } };
  }
}

/**
 * `null` quand le brouillon est incomplet — un declencheur sans effet est
 * refuse par `zTrigger`, et le laisser partir ferait echouer tout l'import
 * de la fiche pour une ligne vide oubliee.
 */
export function draftToTrigger(draft: TriggerDraft, id: string): Trigger | null {
  const then = effectFrom(draft);
  if (!then) return null;
  const condition = conditionFrom(draft);
  return { id, when: { event: draft.event }, ...(condition ? { if: condition } : {}), then: [then] };
}
