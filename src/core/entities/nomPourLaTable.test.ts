import { describe, expect, it } from "vitest";
import { planNomTable } from "./nomPourLaTable";

const fiche = { name: "Aldren Voss", aliases: ["Voss"] };

describe("le nom pour la table (AG-12)", () => {
  it("remplir le champ cache le vrai nom et ses alias, et renomme les liens qui les affichent", () => {
    expect(planNomTable(fiche, null, "  Le propriétaire inconnu ")).toEqual({
      kind: "activer",
      entite: { name: "Le propriétaire inconnu", aliases: [] },
      secret: { trueName: "Aldren Voss", trueAliases: ["Voss"] },
      anciens: ["Aldren Voss", "Voss"],
      nouveau: "Le propriétaire inconnu",
    });
  });

  it("changer le nom pour la table garde le secret tel quel", () => {
    const secret = { trueName: "Aldren Voss", trueAliases: ["Voss"] };
    expect(planNomTable({ name: "L'inconnu", aliases: [] }, secret, "Le vieux marin")).toEqual({
      kind: "changer",
      entite: { name: "Le vieux marin", aliases: [] },
      anciens: ["L'inconnu"],
      nouveau: "Le vieux marin",
    });
  });

  it("vider le champ révèle le vrai nom et rend ses alias", () => {
    const secret = { trueName: "Aldren Voss", trueAliases: ["Voss"] };
    expect(planNomTable({ name: "L'inconnu", aliases: ["Voss", "Le marin"] }, secret, "  ")).toEqual({
      kind: "reveler",
      entite: { name: "Aldren Voss", aliases: ["Voss", "Le marin"] },
      anciens: ["L'inconnu"],
      nouveau: "Aldren Voss",
    });
    expect(planNomTable({ name: "L'inconnu", aliases: [] }, secret, "Aldren Voss").kind).toBe("reveler");
  });

  it("rien à faire : pas de secret et champ vide, ou nom inchangé", () => {
    expect(planNomTable(fiche, null, null)).toEqual({ kind: "aucun" });
    expect(planNomTable(fiche, null, "Aldren Voss")).toEqual({ kind: "aucun" });
    expect(planNomTable({ name: "L'inconnu", aliases: [] }, { trueName: "A", trueAliases: [] }, "L'inconnu")).toEqual({ kind: "aucun" });
  });
});
