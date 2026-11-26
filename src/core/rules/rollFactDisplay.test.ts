import { describe, expect, it } from "vitest";
import { factSansIssue } from "./rollFactDisplay";

describe("le fait d'un jet sans DD ni issue (V3.2-20)", () => {
  it("retire le DD et la réussite d'un test", () => {
    expect(factSansIssue("Edran — Persuasion — test de Charisme sur Mabelle : 14 (dé : 15, Charisme −1) contre DD 13 — réussite.")).toBe(
      "Edran — Persuasion — test de Charisme sur Mabelle : 14 (dé : 15, Charisme −1)."
    );
    expect(factSansIssue("Edran — Sauvegarde de Dextérité : 8 (dé : 6) contre DD 13 — échec.")).toBe("Edran — Sauvegarde de Dextérité : 8 (dé : 6).");
  });
  it("retire la CA et « touché » ou « raté » d'une attaque, mais garde le critique, qui se lit sur le dé", () => {
    expect(factSansIssue("Edran — Attaque — Épée longue sur Gobelin : 17 (dé : 12) contre CA 15 — touché.")).toBe("Edran — Attaque — Épée longue sur Gobelin : 17 (dé : 12).");
    expect(factSansIssue("Edran attaque Gobelin avec Épée longue : 25 (dé : 20) contre CA 15 — touché — critique.")).toBe("Edran attaque Gobelin avec Épée longue : 25 (dé : 20) — critique.");
    expect(factSansIssue("Edran attaque Gobelin avec Épée longue : 4 (dé : 1) contre CA 15 — raté — échec critique.")).toBe("Edran attaque Gobelin avec Épée longue : 4 (dé : 1) — échec critique.");
  });
  it("laisse intact un fait sans DD, sans issue, ou qui n'est pas un jet", () => {
    expect(factSansIssue("Edran Vauclair — Persuasion — test de Charisme : 14 (dé : 15).")).toBe("Edran Vauclair — Persuasion — test de Charisme : 14 (dé : 15).");
    expect(factSansIssue("Dégâts sur Gobelin : 7.")).toBe("Dégâts sur Gobelin : 7.");
  });
});
