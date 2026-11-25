import { describe, expect, it } from "vitest";
import { premierParagraphe, premierePhrase, type SegmentLu } from "./premierePhrase";

const p = (...content: SegmentLu["content"]): SegmentLu => ({ blockType: "paragraph", content });
const txt = (v: string, marks?: ("bold" | "spoiler")[]) => ({ t: "text" as const, v, ...(marks ? { marks } : {}) });

describe("premierePhrase (V3.1-82)", () => {
  it("la première phrase du premier paragraphe", () => {
    expect(premierePhrase([p(txt("Éclaireuse des Hautes-Landes. Elle traque ce qui a brûlé son village."))])).toBe(
      "Éclaireuse des Hautes-Landes."
    );
  });
  it("les titres et les traits sont sautés ; un paragraphe vide aussi", () => {
    expect(
      premierePhrase([
        { blockType: "h2", content: [txt("Origines")] },
        { blockType: "divider", content: [] },
        p(txt("   ")),
        p(txt("Né sous la pluie !"), txt(" Rien d'autre.")),
      ])
    ).toBe("Né sous la pluie !");
  });
  it("les nœuds de texte se suivent, une référence donne son libellé", () => {
    expect(premierePhrase([p(txt("Fille de "), { t: "ref", kind: "entity", id: "e1", label: "Thorin" }, txt(", forgeronne."))])).toBe(
      "Fille de Thorin, forgeronne."
    );
  });
  it("un passage marqué spoiler n'est jamais repris", () => {
    expect(premierePhrase([p(txt("Héritière cachée", ["spoiler"]), txt("Une voyageuse discrète."))])).toBe("Une voyageuse discrète.");
    expect(premierePhrase([p(txt("Tout est secret.", ["spoiler"]))])).toBeNull();
  });
  it("sans ponctuation finale : tout le paragraphe ; trop long : coupé à un mot, avec points de suspension", () => {
    expect(premierePhrase([p(txt("Une voyageuse sans attaches"))])).toBe("Une voyageuse sans attaches");
    const long = "mot ".repeat(60).trim();
    const coupe = premierePhrase([p(txt(long))], 40);
    expect(coupe).not.toBeNull();
    expect(coupe!.length).toBeLessThanOrEqual(41);
    expect(coupe!.endsWith("…")).toBe(true);
    expect(coupe!.endsWith(" …")).toBe(false);
  });
  it("aucun paragraphe : null", () => {
    expect(premierePhrase([])).toBeNull();
  });
});

describe("premierParagraphe — la description d'un lieu pour la narration", () => {
  it("le premier paragraphe entier, titres sautés", () => {
    expect(
      premierParagraphe([{ blockType: "h2", content: [txt("Aperçu")] }, p(txt("Une auberge basse. Le toit fuit.")), p(txt("Second paragraphe."))])
    ).toBe("Une auberge basse. Le toit fuit.");
  });
  it("trop long : coupé à la dernière phrase entière qui tient", () => {
    expect(premierParagraphe([p(txt("Une auberge basse. Le toit fuit depuis des années."))], 25)).toBe("Une auberge basse.");
  });
  it("une seule phrase trop longue : coupée à un mot, avec points de suspension", () => {
    const coupe = premierParagraphe([p(txt("mot ".repeat(40).trim()))], 30);
    expect(coupe!.length).toBeLessThanOrEqual(31);
    expect(coupe!.endsWith("…")).toBe(true);
  });
  it("un passage spoiler n'est jamais repris ; aucun paragraphe : null", () => {
    expect(premierParagraphe([p(txt("Secret.", ["spoiler"]))])).toBeNull();
    expect(premierParagraphe([])).toBeNull();
  });
});

