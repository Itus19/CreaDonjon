import { describe, expect, it } from "vitest";
import { modificateursDeLaFiche, texteVersValeur, valeurVersTexte } from "./modificateursFiche";

describe("valeur d'un modificateur de fiche", () => {
  it("garde un nombre comme un nombre", () => {
    expect(texteVersValeur("2", "ac")).toEqual({ ok: true, value: 2 });
    expect(valeurVersTexte(2)).toBe("2");
  });

  it("accepte un dé sur une cible de jet et le refuse sur une cible fixe", () => {
    const sauvegarde = texteVersValeur("1d4", "save.wis");
    expect(sauvegarde.ok && typeof sauvegarde.value).toBe("object");
    const ca = texteVersValeur("1d4", "ac");
    expect(ca.ok).toBe(false);
    if (!ca.ok) expect(ca.erreur).toContain("Un dé ne s'ajoute qu'à un jet");
  });

  it("explique une formule fausse ou vide sans lever", () => {
    expect(texteVersValeur("max(1,", "ac").ok).toBe(false);
    expect(texteVersValeur("  ", "ac").ok).toBe(false);
  });

  it("relit une formule enregistrée comme du texte, jamais « [object Object] »", () => {
    const ecrit = texteVersValeur("max(1, {ability.cha})", "save");
    if (!ecrit.ok) throw new Error("formule refusée");
    const lus = modificateursDeLaFiche([{ blockType: "modifiers", data: { modifiers: [{ target: "save", op: "add", value: ecrit.value }, { target: "ac", op: "add", value: 1 }] } }]);
    expect(lus.map((m) => m.value)).toEqual(["max(1, {ability.cha})", "1"]);
    expect(modificateursDeLaFiche([])).toEqual([]);
  });
});
