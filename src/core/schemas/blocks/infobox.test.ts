import { describe, expect, it } from "vitest";
import { infoboxEntityRefIds, infoboxValueNodes, infoboxValueText, zInfoboxBlockData } from "./infobox";

const mention = { t: "ref" as const, kind: "entity" as const, id: "e1", label: "Phandaline" };

describe("valeur d'Encadré (V3.1-66)", () => {
  it("accepte l'ancienne forme (une chaîne) et la nouvelle (des nœuds)", () => {
    expect(zInfoboxBlockData.safeParse({ __v: 1, entries: [{ label: "Région", value: "Côte des Épées" }] }).success).toBe(true);
    expect(
      zInfoboxBlockData.safeParse({ __v: 1, entries: [{ label: "Dirigeant", value: [{ t: "text", v: "Maire de " }, mention] }] }).success
    ).toBe(true);
  });

  it("refuse une mention mal formée", () => {
    expect(zInfoboxBlockData.safeParse({ __v: 1, entries: [{ label: "X", value: [{ t: "ref", kind: "entity", label: "sans id" }] }] }).success).toBe(false);
  });

  it("les nœuds d'une chaîne : un seul texte, aucun pour une chaîne vide", () => {
    expect(infoboxValueNodes("Côte")).toEqual([{ t: "text", v: "Côte" }]);
    expect(infoboxValueNodes("")).toEqual([]);
    expect(infoboxValueNodes([mention])).toEqual([mention]);
  });

  it("le texte brut lit les mentions par leur libellé", () => {
    expect(infoboxValueText("42 ans")).toBe("42 ans");
    expect(infoboxValueText([{ t: "text", v: "Maire de " }, mention])).toBe("Maire de Phandaline");
  });

  it("les fiches citées, sans doublon, sans règle ni image", () => {
    const data = zInfoboxBlockData.parse({
      __v: 1,
      entries: [
        { label: "A", value: [mention, { t: "text", v: " et " }, mention] },
        { label: "B", value: [{ t: "ref", kind: "rule", key: "goblin", label: "Gobelin" }, { t: "ref", kind: "entity", id: "e2", label: "Sildar" }] },
        { label: "C", value: "rien" },
      ],
    });
    expect(infoboxEntityRefIds(data)).toEqual(["e1", "e2"]);
  });
});
