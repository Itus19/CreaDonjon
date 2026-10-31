import { describe, expect, it } from "vitest";
import { tirerCaracteristiques, zTirageCaracteristiques } from "./tirageCaracteristiques";

/** Un générateur fixé : chaque tirage rend l'index suivant de la liste (règle 8 : le serveur lance, le test fixe le hasard). */
function rngFixe(index: number[]) {
  let i = 0;
  return { nextInt: () => index[i++ % index.length] };
}

describe("le tirage des caractéristiques, par le serveur (V3.1-52)", () => {
  it("le client n'envoie que le monde ; un corps qui porte des valeurs est refusé", () => {
    expect(zTirageCaracteristiques.safeParse({ worldSlug: "banc-d-essai" }).success).toBe(true);
    expect(zTirageCaracteristiques.safeParse({ worldSlug: "banc-d-essai", rolls: [18, 18, 18, 18, 18, 18] }).success).toBe(false);
    expect(zTirageCaracteristiques.safeParse({ worldSlug: "banc-d-essai", scores: { str: 18 } }).success).toBe(false);
  });

  it("la formule vient du ruleset : 4d6, on garde les trois meilleurs, six tirages", () => {
    const rolls = tirerCaracteristiques({ dice_count: 4, dice_faces: 6, keep_highest: 3, rolls: 6 }, rngFixe([5, 5, 5, 0]));
    expect(rolls).toHaveLength(6);
    expect(rolls[0]).toBe(18);
    for (const r of rolls) expect(r >= 3 && r <= 18).toBe(true);
  });
});
