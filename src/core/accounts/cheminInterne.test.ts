import { describe, expect, it } from "vitest";
import { cheminInterne } from "./cheminInterne";

describe("cheminInterne", () => {
  it("garde un chemin de l'app, avec sa requête", () => {
    expect(cheminInterne("/m/faerun/f/candide-fausset")).toBe("/m/faerun/f/candide-fausset");
    expect(cheminInterne("/m/faerun/mj?outil=initiative")).toBe("/m/faerun/mj?outil=initiative");
  });

  it("refuse une adresse d'un autre site, sous toutes ses formes", () => {
    expect(cheminInterne("https://exemple.com")).toBeNull();
    expect(cheminInterne("//exemple.com")).toBeNull();
    expect(cheminInterne("/\\exemple.com")).toBeNull();
    expect(cheminInterne("\\\\exemple.com")).toBeNull();
    expect(cheminInterne("javascript:alert(1)")).toBeNull();
    expect(cheminInterne("exemple.com")).toBeNull();
  });

  it("refuse les caractères de contrôle, qu'un navigateur peut retirer pour former //", () => {
    expect(cheminInterne("/\t/exemple.com")).toBeNull();
    expect(cheminInterne("/\n/exemple.com")).toBeNull();
  });

  it("refuse ce qui n'est pas une chaîne, une chaîne vide ou trop longue", () => {
    expect(cheminInterne(undefined)).toBeNull();
    expect(cheminInterne(null)).toBeNull();
    expect(cheminInterne(42)).toBeNull();
    expect(cheminInterne("")).toBeNull();
    expect(cheminInterne(`/${"a".repeat(600)}`)).toBeNull();
  });
});
