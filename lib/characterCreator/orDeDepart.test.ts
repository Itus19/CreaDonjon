import { describe, expect, it } from "vitest";
import { lancerOrDeDepart, zLancerOrDeDepart } from "./orDeDepart";

function rngFixe(index: number[]) {
  let i = 0;
  return { nextInt: () => index[i++ % index.length] };
}

describe("l'or du départ à haut niveau, lancé par le serveur (V3.1-53)", () => {
  it("le client n'envoie que les dés, jamais un résultat", () => {
    expect(zLancerOrDeDepart.safeParse({ count: 1, faces: 10 }).success).toBe(true);
    expect(zLancerOrDeDepart.safeParse({ count: 1, faces: 10, rolls: [10] }).success).toBe(false);
    expect(zLancerOrDeDepart.safeParse({ count: 11, faces: 10 }).success).toBe(false);
    expect(zLancerOrDeDepart.safeParse({ count: 1, faces: 1 }).success).toBe(false);
  });

  it("autant de jets que de dés, chacun entre 1 et les faces", () => {
    expect(lancerOrDeDepart({ count: 2, faces: 10 }, rngFixe([0, 9]))).toEqual([1, 10]);
  });
});
