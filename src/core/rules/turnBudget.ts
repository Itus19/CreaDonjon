import { z } from "zod";
import type { ActivationCost, CastOption } from "../schemas/rule-blocks/playable";

/**
 * V3.1-164 (ADR 0076) — l'économie d'action d'un participant, comptée en
 * combat, en fonctions PURES. Rangée dans `turn_usage.budget` (ADR 0075) et
 * datée du dernier tour du participant : quand son tour change, le budget
 * repart neuf, sans aucune écriture au passage de tour (ni à son annulation).
 * Jamais bloquant (ADR 0029) : un dépassement est signalé, le MJ tranche.
 */

export const zTurnBudget = z.object({
  /** `"<round>:<turn_index>"` du tour du participant auquel ce budget appartient. */
  at: z.string(),
  action: z.number().int(),
  bonus: z.number().int(),
  /** Attaques restantes de l'action Attaque déjà ouverte (Attaque supplémentaire). */
  attacks: z.number().int(),
  /** Actions accordées qui ne paient pas l'action Magie (Sursaut d'action). */
  extraNotMagic: z.number().int(),
  /** V3.1-169 (ADR 0077) : mètres parcourus pendant le tour (absent : rien encore). */
  moved: z.number().min(0).optional(),
  /** Mètres accordés en plus de la vitesse pendant ce tour (Athlète accompli : la moitié de la Vitesse après un critique). */
  extraMovement: z.number().min(0).optional(),
  /** Une attaque de l'action Attaque faite avec une arme Légère ce tour : l'attaque en plus de la propriété Légère est ouverte (vrai), ou déjà faite (faux). */
  lightAttack: z.boolean().optional(),
});
export type TurnBudget = z.infer<typeof zTurnBudget>;

export const EMPTY_TURN_BUDGET: TurnBudget = { at: "", action: 1, bonus: 1, attacks: 0, extraNotMagic: 0 };

/** La date du dernier tour du participant (`ownTurnIndex` dans l'ordre) : celui du round en cours s'il est passé, sinon celui du round d'avant. */
export function ownTurnStamp(now: { round: number; turnIndex: number }, ownTurnIndex: number): string {
  return now.turnIndex >= ownTurnIndex ? `${now.round}:${ownTurnIndex}` : `${now.round - 1}:${ownTurnIndex}`;
}

/** Le budget de ce tour-ci : repris s'il est daté de ce tour, neuf sinon. */
export function budgetForTurn(stored: TurnBudget | undefined, ownStamp: string): TurnBudget {
  if (stored && stored.at === ownStamp) return stored;
  return { ...EMPTY_TURN_BUDGET, at: ownStamp };
}

/** Ce qu'une activation ou un geste coûte au budget. `reaction` se compte ailleurs (ADR 0075). */
export type TurnSpend = ActivationCost["action"];

/**
 * Dépenser. `attack` : la première attaque d'arme du tour ouvre l'action
 * Attaque (`attacks = attacksPerAction − 1`), les suivantes la consomment.
 * Une action accordée « pas pour la Magie » paie une action ou une attaque,
 * jamais l'action Magie.
 */
export function spendTurnBudget(budget: TurnBudget, kind: TurnSpend, attacksPerAction: number, opts: { lightWeapon?: boolean } = {}): { budget: TurnBudget; over: boolean } {
  switch (kind) {
    case "none":
    case "free":
    case "reaction":
      return { budget, over: false };
    case "bonus": {
      const next = { ...budget, bonus: budget.bonus - 1 };
      return { budget: next, over: next.bonus < 0 };
    }
    case "magic": {
      const next = { ...budget, action: budget.action - 1 };
      return { budget: next, over: next.action < 0 };
    }
    case "action":
      return payAction(budget);
    case "attack": {
      // Une attaque avec une arme Légère ouvre l'attaque en plus (propriété Légère), une seule fois par tour.
      const legere = (b: TurnBudget): TurnBudget => (opts.lightWeapon && b.lightAttack === undefined ? { ...b, lightAttack: true } : b);
      if (budget.attacks > 0) return { budget: legere({ ...budget, attacks: budget.attacks - 1 }), over: false };
      const r = payAction(budget);
      // En dépassement, aucune action Attaque ne s'ouvre : chaque attaque de plus reste signalée.
      if (r.over) return { budget: { ...r.budget, attacks: 0 }, over: true };
      return { budget: legere({ ...r.budget, attacks: Math.max(0, attacksPerAction - 1) }), over: false };
    }
  }
}

/**
 * Combat à deux armes — l'attaque en plus de la propriété Légère : une action
 * Bonus, après une attaque de l'action Attaque faite avec une arme Légère, une
 * fois par tour. Jamais bloquant : sans attaque Légère avant, `over` le dit.
 */
export function spendLightExtraAttack(budget: TurnBudget): { budget: TurnBudget; over: boolean } {
  const bonus = budget.bonus - 1;
  return { budget: { ...budget, bonus, lightAttack: false }, over: bonus < 0 || budget.lightAttack !== true };
}

function payAction(budget: TurnBudget): { budget: TurnBudget; over: boolean } {
  if (budget.action > 0) return { budget: { ...budget, action: budget.action - 1 }, over: false };
  if (budget.extraNotMagic > 0) return { budget: { ...budget, extraNotMagic: budget.extraNotMagic - 1 }, over: false };
  return { budget: { ...budget, action: budget.action - 1 }, over: true };
}

/** Accorder (Sursaut d'action : une action, pas pour la Magie ; Athlète accompli : du mouvement). */
export function grantTurnBudget(budget: TurnBudget, p: { kind: "action" | "bonus" | "movement"; amount: number; notMagic?: boolean }): TurnBudget {
  if (p.kind === "bonus") return { ...budget, bonus: budget.bonus + p.amount };
  // Du mouvement en plus (mètres), pour ce tour seulement : le budget repart neuf au tour suivant.
  if (p.kind === "movement") return { ...budget, extraMovement: Math.max(0, (budget.extraMovement ?? 0) + p.amount) };
  return p.notMagic ? { ...budget, extraNotMagic: budget.extraNotMagic + p.amount } : { ...budget, action: budget.action + p.amount };
}

/** Une option de lancement change le coût du sort : son temps d'incantation, et ses ressources s'ajoutent. */
export function applyCastOption(cost: ActivationCost, option: CastOption): ActivationCost {
  return {
    ...cost,
    action: option.changes.action ?? cost.action,
    resources: [...cost.resources, ...option.cost.resources],
  };
}

/**
 * V3.1-169 (ADR 0077) — se déplacer pendant son tour dépense le mouvement :
 * `metres` s'ajoute à ce qui est déjà parcouru, comparé à la vitesse (en
 * mètres). Jamais bloquant : `over` le dit, le MJ tranche (Foncer double la
 * vitesse, il le sait).
 */
export function spendMovement(budget: TurnBudget, metres: number, speedMetres: number): { budget: TurnBudget; over: boolean; moved: number } {
  const moved = Math.round(((budget.moved ?? 0) + Math.max(0, metres)) * 100) / 100;
  return { budget: { ...budget, moved }, over: moved > speedMetres + (budget.extraMovement ?? 0) + 1e-9, moved };
}
