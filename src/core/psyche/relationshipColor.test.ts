import { describe, expect, it } from "vitest";
import { relationshipColor } from "./relationshipColor";

describe("relationshipColor", () => {
  it("est quasi neutre (chroma faible) a la valeur 0", () => {
    const color = relationshipColor(0);
    const chroma = Number(color.match(/oklch\([\d.]+ ([\d.]+)/)?.[1]);
    expect(chroma).toBeLessThan(0.02);
  });

  it("penche vert (teinte amicale) au positif, rouge (hostile) au negatif", () => {
    expect(relationshipColor(80)).toContain(" 145)");
    expect(relationshipColor(-80)).toContain(" 25)");
  });

  it("sature davantage en s'eloignant du neutre", () => {
    const near = Number(relationshipColor(10).match(/oklch\([\d.]+ ([\d.]+)/)?.[1]);
    const far = Number(relationshipColor(90).match(/oklch\([\d.]+ ([\d.]+)/)?.[1]);
    expect(far).toBeGreaterThan(near);
  });

  it("la romance l'emporte sur le degrade, meme hostile", () => {
    expect(relationshipColor(-90, ["married_to"])).toContain(" 340)");
    expect(relationshipColor(-90, ["ex_partner_of"])).toContain(" 340)");
  });

  it("un type de relation non romantique n'affecte pas la couleur", () => {
    expect(relationshipColor(50, ["friend_of"])).toBe(relationshipColor(50));
  });
});
