import { describe, expect, it } from "vitest";
import { itemFromNarration } from "./narratedItem";

const inventaire = (items: unknown[]) => ({ __v: 1 as const, items: items as never, containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } });

describe("itemFromNarration — V3.2-54, un objet nommé par le récit entre dans l'inventaire", () => {
  it("une arme connue devient une référence de règle : ses chiffres viennent des règles", () => {
    expect(itemFromNarration({ name: "une dague", hidden: false }, inventaire([]))).toEqual({ id: "recit-0", qty: 1, equipped: true, ref: { kind: "rule", key: "dagger" } });
  });

  it("un objet sans règle reste un objet en ligne, avec son nom", () => {
    expect(itemFromNarration({ name: "Chope d'étain", hidden: false }, inventaire([]))).toEqual({ id: "recit-0", qty: 1, equipped: true, label: "Chope d'étain" });
  });

  it("un objet caché le reste", () => {
    expect(itemFromNarration({ name: "Lettre pliée", hidden: true }, inventaire([]))).toMatchObject({ concealed: true });
  });

  it("un objet déjà là n'entre pas une seconde fois, même écrit autrement", () => {
    expect(itemFromNarration({ name: "Tablier", hidden: false }, inventaire([{ id: "pnj-0", qty: 1, label: "tablier" }]))).toBeNull();
    expect(itemFromNarration({ name: "la dague", hidden: false }, inventaire([{ id: "pnj-1", qty: 1, ref: { kind: "rule", key: "dagger" } }]))).toBeNull();
  });

  it("l'identifiant ne reprend jamais celui d'un objet existant", () => {
    const inv = inventaire([{ id: "recit-0", qty: 1, label: "Chope" }]);
    expect(itemFromNarration({ name: "Torchon", hidden: false }, inv)?.id).toBe("recit-1");
  });

  it("un nom vide ou trop long est refusé", () => {
    expect(itemFromNarration({ name: "  ", hidden: false }, inventaire([]))).toBeNull();
    expect(itemFromNarration({ name: "x".repeat(81), hidden: false }, inventaire([]))).toBeNull();
  });
});
