import { describe, expect, it } from "vitest";
import {
  budgetForTurn,
  grantToBudget,
  isOverBudget,
  spendFromBudget,
  zActionBudget,
  type ActionBudget,
} from "./actionBudget";

const FRAIS: ActionBudget = budgetForTurn(9);

describe("le budget d'un tour", () => {
  it("part d'une action, une action bonus, une reaction, une interaction gratuite", () => {
    expect(FRAIS).toMatchObject({ action: 1, bonus: 1, reaction: 1, free: 1 });
  });

  it("derive le deplacement de la vitesse, en metres", () => {
    expect(budgetForTurn(9).movement).toBe(9);
    expect(budgetForTurn(12).movement).toBe(12);
  });
});

/**
 * LE point du ticket (spec §5) : « Signaler, ne pas interdire. Une action
 * sans budget est marquee "hors budget" et reste jouable. Les tables
 * derogent en permanence ; un outil qui bloque devient un outil qu'on
 * contourne. »
 */
describe("signaler, ne pas interdire", () => {
  it("une depense dans le budget ne signale rien", () => {
    const out = spendFromBudget(FRAIS, "action");
    expect(out.budget.action).toBe(0);
    expect(out.overBudget).toBe(false);
  });

  it("une seconde action PASSE quand meme, et se signale", () => {
    const une = spendFromBudget(FRAIS, "action").budget;
    const deux = spendFromBudget(une, "action");
    expect(deux.overBudget).toBe(true);
    // Elle passe : le budget descend en negatif plutot que d'etre refuse.
    expect(deux.budget.action).toBe(-1);
  });

  it("ne leve jamais — un refus obligerait la table a contourner l'outil", () => {
    expect(() => spendFromBudget(FRAIS, "reaction", 99)).not.toThrow();
  });

  it("marche aussi sur le deplacement, qui se depense en metres", () => {
    const out = spendFromBudget(FRAIS, "movement", 12);
    expect(out.overBudget).toBe(true);
    expect(out.budget.movement).toBe(-3);
  });

  it("`isOverBudget` dit si QUOI QUE CE SOIT est depasse", () => {
    expect(isOverBudget(FRAIS)).toBe(false);
    expect(isOverBudget(spendFromBudget(FRAIS, "bonus", 2).budget)).toBe(true);
  });
});

describe("un declencheur accorde ou retire du budget", () => {
  it("accorde une action bonus — la Fougue du guerrier, en donnees", () => {
    expect(grantToBudget(FRAIS, "bonus", 1).bonus).toBe(2);
  });

  it("retire, avec un montant negatif", () => {
    expect(grantToBudget(FRAIS, "reaction", -1).reaction).toBe(0);
  });

  it("retirer plus qu'il n'y a laisse un negatif, jamais un plancher silencieux", () => {
    // Un plancher a zero cacherait que la regle a retire plus que disponible.
    expect(grantToBudget(FRAIS, "action", -3).action).toBe(-2);
  });

  it("ne touche que la categorie visee", () => {
    expect(grantToBudget(FRAIS, "bonus", 1)).toMatchObject({ action: 1, reaction: 1, free: 1 });
  });
});

describe("le schema", () => {
  it("accepte un budget entame et meme depasse", () => {
    expect(zActionBudget.safeParse({ action: -1, bonus: 0, reaction: 1, movement: -3, free: 1 }).success).toBe(true);
  });

  it("refuse un budget a virgule", () => {
    expect(zActionBudget.safeParse({ ...FRAIS, action: 0.5 }).success).toBe(false);
  });
});
