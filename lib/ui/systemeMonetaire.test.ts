import { describe, expect, it } from "vitest";
import { DEFAULT_CURRENCY_SYSTEM, type CurrencySystem } from "@/src/core/rules/currency";
import { ajouterPiece, brouillonDe, deplacerDansOrdre, systemeDe } from "./systemeMonetaire";

/** V3.1-220 (ADR 0102) — le formulaire du système monétaire : un brouillon de chaînes, validé par le schéma du bloc. */
const avecCouronne: CurrencySystem = {
  coins: [...DEFAULT_CURRENCY_SYSTEM.coins, { key: "crown", label: { fr: "Couronne", en: "Crown" }, value_cp: 500, role: "common" }],
  break_order: ["ep", "pp"],
};

describe("brouillonDe / systemeDe", () => {
  it("aller-retour : le système relu est identique (défaut, et avec une pièce maison)", () => {
    expect(systemeDe(brouillonDe(DEFAULT_CURRENCY_SYSTEM))).toEqual({ ok: true, systeme: DEFAULT_CURRENCY_SYSTEM });
    expect(systemeDe(brouillonDe(avecCouronne))).toEqual({ ok: true, systeme: avecCouronne });
  });

  it("une pièce ajoutée par le formulaire, une fois remplie, entre dans le système", () => {
    const b = ajouterPiece(brouillonDe(DEFAULT_CURRENCY_SYSTEM));
    const i = b.pieces.length - 1;
    b.pieces[i] = { key: "crown", fr: "Couronne", en: "Crown", valeur: "500", role: "common" };
    const r = systemeDe(b);
    expect(r.ok && r.systeme.coins.at(-1)).toEqual({ key: "crown", label: { fr: "Couronne", en: "Crown" }, value_cp: 500, role: "common" });
  });

  it("l'ordre de casse suit les rôles : une réserve nouvelle s'ajoute à la fin, une pièce devenue courante en sort", () => {
    const b = brouillonDe(DEFAULT_CURRENCY_SYSTEM);
    b.pieces = b.pieces.map((p) => (p.key === "ep" ? { ...p, role: "common" as const } : p));
    b.pieces.push({ key: "gem_shard", fr: "Éclat", en: "Shard", valeur: "200", role: "reserve" });
    const r = systemeDe(b);
    expect(r.ok && r.systeme.break_order).toEqual(["pp", "gem_shard"]);
  });

  it("déplacer une réserve dans l'ordre de casse", () => {
    expect(deplacerDansOrdre(brouillonDe(DEFAULT_CURRENCY_SYSTEM), "pp", -1).ordre).toEqual(["pp", "ep"]);
    expect(deplacerDansOrdre(brouillonDe(DEFAULT_CURRENCY_SYSTEM), "pp", 1).ordre).toEqual(["ep", "pp"]);
  });

  it("refuse avec un message : valeur non entière, clé en double, plus de pièce de valeur 1", () => {
    const b = brouillonDe(avecCouronne);
    expect(systemeDe({ ...b, pieces: b.pieces.map((p) => (p.key === "crown" ? { ...p, valeur: "2,5" } : p)) })).toMatchObject({ ok: false });
    expect(systemeDe({ ...b, pieces: b.pieces.map((p) => (p.key === "crown" ? { ...p, key: "gp" } : p)) })).toMatchObject({ ok: false, message: expect.stringContaining("même clé") });
    expect(systemeDe({ ...b, pieces: b.pieces.filter((p) => p.key !== "cp") })).toMatchObject({ ok: false, message: expect.stringContaining("valeur 1") });
  });
});
