import { describe, expect, it } from "vitest";
import { DEFAULT_TABLE_SETTINGS } from "@/src/core/campaigns/tableSettings";
import { arbreRulesets, baseDeRetour, bornerInspirationMax, peutExporter, reglagesParDefaut, type RulesetListe } from "./reglesActives";

function r(id: string, parent: string | null, extra: Partial<RulesetListe> = {}): RulesetListe {
  return { id, name: id, is_official_base: parent === null, parent_ruleset_id: parent, content_origin: "homebrew", ...extra };
}

describe("arbreRulesets", () => {
  it("range les variantes sous leur base, dans l'ordre reçu", () => {
    const lignes = arbreRulesets([r("b24", null), r("b14", null), r("v1", "b14"), r("v2", "b24"), r("v3", "b24")]);
    expect(lignes.map((l) => [l.ruleset.id, l.profondeur, l.dernier])).toEqual([
      ["b24", 0, false],
      ["v2", 1, false],
      ["v3", 1, true],
      ["b14", 0, true],
      ["v1", 1, true],
    ]);
  });

  it("descend dans les variantes de variantes", () => {
    const lignes = arbreRulesets([r("b", null), r("v1", "b"), r("v2", "v1")]);
    expect(lignes.map((l) => l.profondeur)).toEqual([0, 1, 2]);
  });

  it("remonte à la racine une variante dont le parent est absent", () => {
    const lignes = arbreRulesets([r("b", null), r("orpheline", "inconnu")]);
    expect(lignes.map((l) => [l.ruleset.id, l.profondeur])).toEqual([
      ["b", 0],
      ["orpheline", 0],
    ]);
  });
});

describe("peutExporter", () => {
  it("refuse une base officielle et une référence personnelle, accepte une variante", () => {
    expect(peutExporter(r("b", null, { content_origin: "official_srd" }))).toBe(false);
    expect(peutExporter(r("v", "b", { content_origin: "personal_reference" }))).toBe(false);
    expect(peutExporter(r("v", "b"))).toBe(true);
  });
});

describe("baseDeRetour", () => {
  it("rend le parent de la variante, ou null", () => {
    const options = [r("b", null), r("v", "b")];
    expect(baseDeRetour(options, "v")?.id).toBe("b");
    expect(baseDeRetour(options, "b")).toBeNull();
    expect(baseDeRetour(options, "absent")).toBeNull();
  });
});

describe("réglages de table", () => {
  it("« Par défaut » remet les six réglages et l'inspiration au plus", () => {
    expect(reglagesParDefaut()).toEqual(DEFAULT_TABLE_SETTINGS);
    expect(reglagesParDefaut().player_can_edit).not.toBe(DEFAULT_TABLE_SETTINGS.player_can_edit);
  });

  it("borne l'inspiration entre 1 et 5", () => {
    expect([0, 1, 3, 5, 6].map(bornerInspirationMax)).toEqual([1, 1, 3, 5, 5]);
  });
});
