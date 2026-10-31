import { describe, expect, it } from "vitest";
import { lancerDesDeVie, zLancerDesDeVie } from "./desDeVie";

/** Un générateur fixé : chaque tirage rend l'index suivant de la liste (règle 8 : le serveur lance, le test fixe le hasard). */
function rngFixe(index: number[]) {
  let i = 0;
  return { nextInt: () => index[i++ % index.length] };
}

describe("« Lancer tous » : les dés de vie lancés par le serveur (V3.1-51)", () => {
  it("le client n'envoie que le dé et le nombre de niveaux, jamais un résultat", () => {
    expect(zLancerDesDeVie.safeParse({ dieFaces: 8, count: 3 }).success).toBe(true);
    expect(zLancerDesDeVie.safeParse({ dieFaces: 8, count: 3, rolls: [8, 8, 8] }).success).toBe(false);
    expect(zLancerDesDeVie.safeParse({ dieFaces: 8, roll: 8 }).success).toBe(false);
  });

  it("un seul niveau par défaut ; au plus dix-neuf (niveaux 2 à 20) ; un dé de vie officiel seulement", () => {
    expect(zLancerDesDeVie.parse({ dieFaces: 10 })).toEqual({ dieFaces: 10, count: 1 });
    expect(zLancerDesDeVie.safeParse({ dieFaces: 10, count: 20 }).success).toBe(false);
    expect(zLancerDesDeVie.safeParse({ dieFaces: 20, count: 1 }).success).toBe(false);
  });

  it("autant de jets que de niveaux, chacun entre 1 et le dé", () => {
    const jets = lancerDesDeVie({ dieFaces: 8, count: 3 }, rngFixe([0, 4, 7]));
    expect(jets).toHaveLength(3);
    for (const j of jets) expect(j >= 1 && j <= 8).toBe(true);
    expect(jets[0]).toBe(1);
    expect(jets[2]).toBe(8);
  });
});
