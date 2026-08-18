import { describe, expect, it } from "vitest";
import { zWeaponProposal, weaponProposalToolSchema } from "./weaponProposal";

describe("zWeaponProposal", () => {
  it("accepte une proposition complete, y compris versatile", () => {
    const result = zWeaponProposal.safeParse({
      category: "martial",
      is_ranged: false,
      damage_dice_count: 1,
      damage_dice_faces: 8,
      damage_type: "tranchant",
      versatile_dice_count: 1,
      versatile_dice_faces: 10,
      weight_lb: 3,
      cost_quantity: 15,
      cost_unit: "gp",
    });
    expect(result.success).toBe(true);
  });

  it("accepte une proposition minimale sans les champs optionnels", () => {
    const result = zWeaponProposal.safeParse({
      category: "simple",
      is_ranged: true,
      damage_dice_count: 1,
      damage_dice_faces: 4,
      damage_type: "perforant",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une face de de hors de la liste fermee (protege l'AST cote moteur)", () => {
    const result = zWeaponProposal.safeParse({
      category: "simple",
      is_ranged: false,
      damage_dice_count: 1,
      damage_dice_faces: 20,
      damage_type: "tranchant",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un type de degats vide", () => {
    const result = zWeaponProposal.safeParse({
      category: "simple",
      is_ranged: false,
      damage_dice_count: 1,
      damage_dice_faces: 6,
      damage_type: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un nombre de des demesure (memes limites d'esprit que l'AST du moteur, 9999d6)", () => {
    const result = zWeaponProposal.safeParse({
      category: "simple",
      is_ranged: false,
      damage_dice_count: 9999,
      damage_dice_faces: 6,
      damage_type: "tranchant",
    });
    expect(result.success).toBe(false);
  });
});

describe("weaponProposalToolSchema", () => {
  it("liste category et damage_type comme champs requis", () => {
    expect(weaponProposalToolSchema.required).toEqual(
      expect.arrayContaining(["category", "is_ranged", "damage_dice_count", "damage_dice_faces", "damage_type"])
    );
  });

  it("n'exige pas les champs optionnels", () => {
    expect(weaponProposalToolSchema.required).not.toContain("versatile_dice_count");
    expect(weaponProposalToolSchema.required).not.toContain("weight_lb");
  });
});
