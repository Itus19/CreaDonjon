import { describe, expect, it } from "vitest";
import { orderPlayerCombatView, type PlayerCombatRow } from "./combatPlayerView";

/** V3.1-102 (ADR 0040) : la vue des joueurs suit EXACTEMENT l'ordre de l'écran du MJ (`turn_index` désigne le même participant). */
function row(id: string, initiative: number | null, displayOrder: number): PlayerCombatRow {
  return { id, label: id, initiative, displayOrder, side: "enemy", entityId: null, conditions: [], hp: null, wound: "hurt" };
}

describe("orderPlayerCombatView", () => {
  const rows = [row("gobelin", 12, 1000), row("naivara", 18, 2000), row("piege", null, 500), row("ogre", 12, 900)];

  it("même ordre que le MJ : initiative décroissante, égalité par ordre d'ajout, sans initiative en dernier", () => {
    const view = orderPlayerCombatView(rows, { status: "running", turnIndex: 0 });
    expect(view.map((p) => p.id)).toEqual(["naivara", "ogre", "gobelin", "piege"]);
    expect(view.map((p) => p.order)).toEqual([1, 2, 3, 4]);
  });

  it("le participant dont c'est le tour, combat en cours", () => {
    const view = orderPlayerCombatView(rows, { status: "running", turnIndex: 2 });
    expect(view.filter((p) => p.isCurrent).map((p) => p.id)).toEqual(["gobelin"]);
  });

  it("personne n'a la main tant que le combat n'a pas commencé", () => {
    expect(orderPlayerCombatView(rows, { status: "draft", turnIndex: 0 }).some((p) => p.isCurrent)).toBe(false);
    expect(orderPlayerCombatView(rows, { status: "ended", turnIndex: 0 }).some((p) => p.isCurrent)).toBe(false);
  });
});
