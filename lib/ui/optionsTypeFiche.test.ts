import { describe, expect, it } from "vitest";
import { optionsTypeFiche } from "@/components/entities/optionsTypeFiche";

/**
 * Une fiche d'un type système (Livre de sessions, page partagée, Chronologie)
 * garde son type dans le menu, mais avec un libellé français, jamais la
 * valeur technique brute.
 */
describe("optionsTypeFiche — types système", () => {
  const courante = (kind: string) => optionsTypeFiche([], kind).find((o) => o.value === kind);

  it("libelle les trois types système", () => {
    expect(courante("session_journal")?.label).toBe("Livre de sessions");
    expect(courante("shared_note")?.label).toBe("Page partagée");
    expect(courante("world_timeline")?.label).toBe("Chronologie du monde");
  });

  it("garde le nom tel quel pour une catégorie inconnue", () => {
    expect(courante("taverne")?.label).toBe("taverne");
  });

  it("ne propose un type système que pour la fiche qui l'a déjà", () => {
    expect(optionsTypeFiche([], "location").some((o) => o.value === "session_journal")).toBe(false);
  });
});
