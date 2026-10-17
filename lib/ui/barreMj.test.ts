import { describe, expect, it } from "vitest";
import { classerPageMj } from "./barreMj";

const OUTILS_REGLE = ["nouveau-don", "bac-a-sable"] as const;
const classer = (chemin: string) => classerPageMj(chemin, "mon-monde", OUTILS_REGLE);

describe("classerPageMj", () => {
  it("ne reconnaît ni la coquille joueur ni l'aperçu public ni une autre route", () => {
    expect(classer("/m/mon-monde/joueur")).toBeNull();
    expect(classer("/m/mon-monde/joueur/wiki")).toBeNull();
    expect(classer("/m/mon-monde/apercu/lyra")).toBeNull();
    expect(classer("/m/autre-monde")).toBeNull();
    expect(classer("/")).toBeNull();
  });

  it("ne confond pas un monde dont le nom en prolonge un autre", () => {
    expect(classerPageMj("/m/mon-monde-bis", "mon-monde", OUTILS_REGLE)).toBeNull();
  });

  it("Monde : l'accueil, une fiche et les autres pages du monde", () => {
    expect(classer("/m/mon-monde")).toEqual({ section: "monde", page: "accueil" });
    expect(classer("/m/mon-monde/f/lyra")).toEqual({ section: "monde", page: "fiche" });
    expect(classer("/m/mon-monde/chronologie")).toEqual({ section: "monde", page: "autre" });
  });

  it("Règles : l'accueil, une règle et un outil de création", () => {
    expect(classer("/m/mon-monde/regles")).toEqual({ section: "regles", page: "accueil" });
    expect(classer("/m/mon-monde/regles/boule-de-feu")).toEqual({ section: "regles", page: "fiche" });
    expect(classer("/m/mon-monde/regles/nouveau-don")).toEqual({ section: "regles", page: "outil" });
  });

  it("MJ : l'accueil, le chat et un outil", () => {
    expect(classer("/m/mon-monde/mj")).toEqual({ section: "mj", page: "accueil" });
    expect(classer("/m/mon-monde/mj/chat")).toEqual({ section: "mj", page: "chat" });
    expect(classer("/m/mon-monde/mj/initiative")).toEqual({ section: "mj", page: "outil" });
  });
});
