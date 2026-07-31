import { describe, expect, it } from "vitest";
import { detectEntityReferences, type LinkableEntity } from "./detect";

const baldur: LinkableEntity = {
  id: "ent-baldur",
  name: "Les Portes de Baldur",
  aliases: ["Les Portes", "Baldur", "La Porte"],
};

describe("detectEntityReferences", () => {
  it("detecte le nom complet d'une entite", () => {
    const matches = detectEntityReferences("Les Portes de Baldur sont un lieu mythique.", [baldur]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ start: 0, end: 20, matchedText: "Les Portes de Baldur" });
    expect(matches[0].candidates).toEqual([{ entityId: "ent-baldur", term: "Les Portes de Baldur" }]);
  });

  it("detecte un alias seul quand le nom complet n'apparait pas", () => {
    const matches = detectEntityReferences("Il vient de Baldur.", [baldur]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ matchedText: "Baldur" });
  });

  it("priorise la correspondance la plus longue : le nom complet masque l'alias qu'il contient", () => {
    const matches = detectEntityReferences("Les Portes de Baldur sont un lieu mythique.", [baldur]);
    // "Baldur" est contenu dans "Les Portes de Baldur" : une seule detection, pas deux.
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedText).toBe("Les Portes de Baldur");
  });

  it("insensible a la casse et aux accents", () => {
    const entity: LinkableEntity = { id: "ent-ancre", name: "L'Ancre Rouillée", aliases: [] };
    const matches = detectEntityReferences("le tavernier de l'ancre rouillee semble jovial.", [entity]);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedText).toBe("l'ancre rouillee");
  });

  it("respecte les frontieres de mots : un alias inclus dans un mot plus long n'est pas detecte", () => {
    const matches = detectEntityReferences("Il est baldurien depuis toujours.", [baldur]);
    expect(matches).toHaveLength(0);
  });

  it("ne detecte pas un alias colle a un autre mot sans espace", () => {
    const matches = detectEntityReferences("prebaldur et baldurpost", [baldur]);
    expect(matches).toHaveLength(0);
  });

  it("deux entites partageant un alias produisent une ambiguite explicite", () => {
    const fine1: LinkableEntity = { id: "ent-fine-1", name: "Fine Lââm", aliases: ["Fine"] };
    const fine2: LinkableEntity = { id: "ent-fine-2", name: "Fine Deux", aliases: ["Fine"] };
    const matches = detectEntityReferences("Fine arrive au village.", [fine1, fine2]);
    expect(matches).toHaveLength(1);
    expect(matches[0].candidates).toHaveLength(2);
    expect(matches[0].candidates.map((c) => c.entityId).sort()).toEqual(["ent-fine-1", "ent-fine-2"]);
  });

  it("ne resout jamais un homonyme au hasard : le nom complet le plus long reste prioritaire meme en cas d'ambiguite sur un terme plus court", () => {
    const fine1: LinkableEntity = { id: "ent-fine-1", name: "Fine Lââm", aliases: ["Fine"] };
    const fine2: LinkableEntity = { id: "ent-fine-2", name: "Fine Deux", aliases: ["Fine"] };
    const matches = detectEntityReferences("Fine Lââm arrive au village.", [fine1, fine2]);
    // "Fine Lââm" (nom complet, non ambigu) masque l'alias ambigu "Fine" qu'il contient.
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedText).toBe("Fine Lââm");
    expect(matches[0].candidates).toEqual([{ entityId: "ent-fine-1", term: "Fine Lââm" }]);
  });

  it("plusieurs occurrences distinctes du meme alias sont toutes rapportees", () => {
    const matches = detectEntityReferences("Baldur est grand. Baldur est loin.", [baldur]);
    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.start)).toEqual([0, 18]);
  });

  it("aucune entite, aucune detection", () => {
    expect(detectEntityReferences("Un texte quelconque.", [])).toEqual([]);
  });

  it("ignore un alias vide", () => {
    const entity: LinkableEntity = { id: "ent-x", name: "Quelque chose", aliases: [""] };
    expect(() => detectEntityReferences("Un texte.", [entity])).not.toThrow();
  });

  it("traite un texte de 5000 mots avec 200 alias en moins de 100 ms", () => {
    const entities: LinkableEntity[] = Array.from({ length: 200 }, (_, i) => ({
      id: `ent-${i}`,
      name: `Personnage Numero ${i}`,
      aliases: [`Alias${i}`],
    }));
    const words = Array.from({ length: 5000 }, (_, i) =>
      i % 137 === 0 ? `Alias${i % 200}` : `mot${i}`
    );
    const text = words.join(" ");

    const start = performance.now();
    detectEntityReferences(text, entities);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });
});
