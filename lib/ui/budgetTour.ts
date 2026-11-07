import { budgetForTurn, ownTurnStamp, type TurnBudget } from "@/src/core/rules/turnBudget";

/**
 * V3.1-166 (ADR 0076) — ce qui reste du budget du tour, pour la carte
 * « Économie d'action ». Pur : le budget vient de la vue filtrée du combat
 * (`PlayerCombatRow.budget`), jamais d'un calcul de la page. Il est daté de
 * SON dernier tour : un budget d'un tour passé se lit neuf (`budgetForTurn`),
 * sans qu'aucune écriture ait remis quoi que ce soit à zéro.
 */

export interface BudgetAffiche {
  /** Actions encore disponibles (accordées « pas pour la Magie » comprises), jamais négatif. */
  action: number;
  bonus: number;
  /** Attaques restantes de l'action Attaque ouverte ; `null` tant qu'aucune n'est ouverte. */
  attaques: { restantes: number; total: number | null } | null;
  /** Le budget est dépassé : signalé, jamais bloquant (ADR 0029). */
  depasse: boolean;
}

export function budgetAffiche(p: {
  /** `null` : rien de dépensé (ou migration pas encore appliquée) — budget neuf. */
  budget: TurnBudget | null | undefined;
  combat: { round: number; turnIndex: number };
  /** Rang du participant dans l'ordre, à partir de 1 (`PlayerCombatParticipant.order`). */
  rang: number;
  /** Le nombre d'attaques par action de la fiche ; `null` s'il n'est pas connu à cet endroit. */
  attaquesParAction: number | null;
}): BudgetAffiche {
  const b = budgetForTurn(p.budget ?? undefined, ownTurnStamp(p.combat, p.rang - 1));
  return {
    action: Math.max(0, b.action) + Math.max(0, b.extraNotMagic),
    bonus: Math.max(0, b.bonus),
    attaques: b.attacks > 0 ? { restantes: b.attacks, total: p.attaquesParAction } : null,
    depasse: b.action < 0 || b.bonus < 0,
  };
}
