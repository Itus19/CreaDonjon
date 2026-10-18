import { describe, expect, it } from "vitest";
import { cheminInvitation } from "./ecranTitre";

describe("cheminInvitation", () => {
  it("mène au chemin Rejoindre depuis un lien complet", () => {
    expect(cheminInvitation("https://exemple.fr/rejoindre/abcd1234efgh")).toBe("/rejoindre/abcd1234efgh");
  });

  it("accepte le jeton seul", () => {
    expect(cheminInvitation("  abcd1234efgh  ")).toBe("/rejoindre/abcd1234efgh");
  });

  it("refuse un texte sans jeton", () => {
    expect(cheminInvitation("bonjour tout le monde")).toBeNull();
    expect(cheminInvitation("")).toBeNull();
  });
});
