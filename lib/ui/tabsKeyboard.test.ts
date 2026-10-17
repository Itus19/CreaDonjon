import { describe, expect, it } from "vitest";
import { nextTabIndex } from "./tabsKeyboard";

describe("nextTabIndex", () => {
  it("avance avec la flèche droite", () => {
    expect(nextTabIndex("ArrowRight", 0, 4)).toBe(1);
  });

  it("reboucle à droite sur le dernier onglet", () => {
    expect(nextTabIndex("ArrowRight", 3, 4)).toBe(0);
  });

  it("recule avec la flèche gauche", () => {
    expect(nextTabIndex("ArrowLeft", 2, 4)).toBe(1);
  });

  it("reboucle à gauche sur le premier onglet", () => {
    expect(nextTabIndex("ArrowLeft", 0, 4)).toBe(3);
  });

  it("Home va au premier, End au dernier", () => {
    expect(nextTabIndex("Home", 2, 5)).toBe(0);
    expect(nextTabIndex("End", 2, 5)).toBe(4);
  });

  it("ignore les autres touches", () => {
    expect(nextTabIndex("Enter", 1, 4)).toBeNull();
    expect(nextTabIndex("ArrowDown", 1, 4)).toBeNull();
  });

  it("ne renvoie rien sans onglet", () => {
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
