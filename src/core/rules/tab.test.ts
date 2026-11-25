import { describe, expect, it } from "vitest";
import { emptyScene, zSceneState } from "./scene";
import { MAX_TAB_LINES, addToTab, clearTabAt, tabAt, tabTotalCp } from "./tab";

describe("l'ardoise, tenue par le moteur dans la scène", () => {
  const fanal = emptyScene("fanal");

  it("une scène sans ardoise n'a rien de dû", () => {
    expect(tabAt(fanal, "fanal")).toEqual([]);
    expect(tabTotalCp(tabAt(fanal, "fanal"))).toBe(0);
  });

  it("une bière mise sur l'ardoise reste due au lieu et à la personne qui l'a servie", () => {
    const scene = addToTab(fanal, { label: "Bière", priceCp: 4, creditor: "Mabelle" });
    expect(scene).not.toBeNull();
    expect(tabAt(scene!, "fanal")).toEqual([{ locationId: "fanal", label: "Bière", priceCp: 4, creditor: "Mabelle" }]);
    // La forme reste valide en base.
    expect(zSceneState.safeParse(scene).success).toBe(true);
  });

  it("survit au changement de scène : l'ardoise d'un autre lieu n'est pas celle d'ici", () => {
    let scene = addToTab(fanal, { label: "Bière", priceCp: 4, creditor: "Mabelle" })!;
    scene = { ...scene, locationId: "marche" };
    expect(tabAt(scene, "marche")).toEqual([]);
    expect(tabTotalCp(tabAt(scene, "fanal"))).toBe(4);
  });

  it("additionne ce qui est dû ici", () => {
    let scene = addToTab(fanal, { label: "Bière", priceCp: 4, creditor: "Mabelle" })!;
    scene = addToTab(scene, { label: "Ragoût", priceCp: 30, creditor: null })!;
    expect(tabTotalCp(tabAt(scene, "fanal"))).toBe(34);
  });

  it("un paiement solde l'ardoise du lieu, et seulement celle-là", () => {
    let scene = addToTab(fanal, { label: "Bière", priceCp: 4, creditor: "Mabelle" })!;
    scene = addToTab({ ...scene, locationId: "marche" }, { label: "Pomme", priceCp: 1, creditor: null })!;
    const soldee = clearTabAt(scene, "fanal");
    expect(tabAt(soldee, "fanal")).toEqual([]);
    expect(tabAt(soldee, "marche")).toHaveLength(1);
  });

  it("refuse d'allonger une ardoise pleine plutôt que d'oublier une dette", () => {
    let scene = fanal;
    for (let i = 0; i < MAX_TAB_LINES; i++) scene = addToTab(scene, { label: "Bière", priceCp: 4, creditor: null })!;
    expect(addToTab(scene, { label: "Bière", priceCp: 4, creditor: null })).toBeNull();
  });
});
