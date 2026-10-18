import { describe, expect, it } from "vitest";
import { requestResetSchema, voieReinitialisation } from "./reinitialisation";

describe("voie de la réinitialisation (V3.1-85)", () => {
  it("un email valide part par le chemin email", () => {
    expect(voieReinitialisation("ana@exemple.fr")).toBe("email");
    expect(voieReinitialisation("  Ana@Exemple.fr ")).toBe("email");
  });
  it("sans « @ », c'est un nom : la demande va au MJ", () => {
    expect(voieReinitialisation("Ana")).toBe("nom");
    expect(voieReinitialisation("Ana la Rousse")).toBe("nom");
  });
  it("un « @ » qui ne fait pas un email reste un nom, jamais un email deviné", () => {
    expect(voieReinitialisation("Ana@")).toBe("nom");
    expect(voieReinitialisation("@ana")).toBe("nom");
  });
});

describe("schéma de la demande (V3.1-85)", () => {
  it("un seul champ, rogné, non vide, borné", () => {
    expect(requestResetSchema.safeParse({ identifier: "  Ana " }).data).toEqual({ identifier: "Ana" });
    expect(requestResetSchema.safeParse({ identifier: "   " }).success).toBe(false);
    expect(requestResetSchema.safeParse({ identifier: "x".repeat(255) }).success).toBe(false);
    expect(requestResetSchema.safeParse({}).success).toBe(false);
  });
});
