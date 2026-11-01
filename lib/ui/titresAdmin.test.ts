import { describe, expect, it } from "vitest";
import { DEFAULT_TITLE_TIERS } from "@/src/core/stats/titleTiers";
import { ajouterPalier, departNouveauPalier, ecrireDecimal, lireDecimal, modifierPalier, rangTouche, retirerPalier, tiersDeFamille } from "./titresAdmin";

describe("lireDecimal / ecrireDecimal", () => {
  it("lit la virgule et le point, le vide comme null", () => {
    expect(lireDecimal("0,8")).toEqual({ ok: true, valeur: 0.8 });
    expect(lireDecimal(" 1.25 ")).toEqual({ ok: true, valeur: 1.25 });
    expect(lireDecimal("2,")).toEqual({ ok: true, valeur: 2 });
    expect(lireDecimal("")).toEqual({ ok: true, valeur: null });
  });
  it("refuse l'illisible et le négatif", () => {
    for (const s of ["abc", "-1", "1,2,3", "1e3", ","]) expect(lireDecimal(s)).toEqual({ ok: false });
  });
  it("écrit avec la virgule", () => {
    expect(ecrireDecimal(0.8)).toBe("0,8");
    expect(ecrireDecimal(2)).toBe("2");
    expect(ecrireDecimal(null)).toBe("");
  });
});

describe("édition de la liste", () => {
  it("modifie un palier sans toucher aux autres", () => {
    const r = modifierPalier(DEFAULT_TITLE_TIERS, "luck", 1, { name: "X" });
    expect(tiersDeFamille(r, "luck").map((t) => t.name)).toEqual(["En attente d'un miracle", "X", "Béni des dés"]);
    expect(r).toHaveLength(DEFAULT_TITLE_TIERS.length);
  });
  it("retire un palier et renumérote, jamais le dernier d'une famille", () => {
    const r = retirerPalier(DEFAULT_TITLE_TIERS, "purse", 0);
    expect(tiersDeFamille(r, "purse").map((t) => t.position)).toEqual([0, 1]);
    let seul = [...DEFAULT_TITLE_TIERS];
    seul = retirerPalier(seul, "purse", 0);
    seul = retirerPalier(seul, "purse", 0);
    expect(retirerPalier(seul, "purse", 0)).toHaveLength(seul.length);
  });
  it("le nouveau palier part de la fin du précédent", () => {
    const luck = tiersDeFamille(DEFAULT_TITLE_TIERS, "luck");
    expect(departNouveauPalier(luck.slice(0, 2))).toBe(1.2);
    expect(departNouveauPalier(luck)).toBe(2.2);
    const r = ajouterPalier(DEFAULT_TITLE_TIERS.slice(0, 2).concat(DEFAULT_TITLE_TIERS.slice(3)), "luck", "Nouveau");
    const dernier = tiersDeFamille(r, "luck").at(-1);
    expect(dernier).toMatchObject({ name: "Nouveau", range_from: 1.2, range_to: null, position: 2 });
  });
  it("une nouvelle action prend une sorte libre", () => {
    const sans = DEFAULT_TITLE_TIERS.filter((t) => !(t.family === "favorite_action" && t.action_kind === "heal"));
    const r = ajouterPalier(sans, "favorite_action", "N");
    expect(tiersDeFamille(r, "favorite_action").at(-1)).toMatchObject({ action_kind: "heal", range_from: null });
  });
  it("garde le jeu complet dans l'ordre des familles", () => {
    const r = ajouterPalier(DEFAULT_TITLE_TIERS, "luck", "N");
    expect(r.map((t) => t.family)).toEqual([...r.map((t) => t.family)].sort((a, b) => ["luck", "bad_luck", "purse", "favorite_action"].indexOf(a) - ["luck", "bad_luck", "purse", "favorite_action"].indexOf(b)));
  });
});

describe("rangTouche", () => {
  it("trouve le palier d'une mesure ou d'une action", () => {
    expect(rangTouche(DEFAULT_TITLE_TIERS, "luck", 1.4)).toBe(2);
    expect(rangTouche(DEFAULT_TITLE_TIERS, "luck", 0.8)).toBe(1);
    expect(rangTouche(DEFAULT_TITLE_TIERS, "favorite_action", "spell")).toBe(2);
    expect(rangTouche(DEFAULT_TITLE_TIERS.filter((t) => t.range_from !== 0), "luck", 0.2)).toBe(-1);
  });
});
