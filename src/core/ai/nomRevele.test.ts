import { describe, expect, it } from "vitest";
import { nomsDitsDans } from "./nomRevele";

const noms = [
  { entityId: "a", trueName: "Mabelle Roux" },
  { entityId: "b", trueName: "Wil, du Fanal" },
  { entityId: "c", trueName: "Al Brann" },
];

describe("nomsDitsDans (V3.2-45)", () => {
  it("le nom entier, la tête avant la virgule, ou le prénom de trois lettres et plus", () => {
    expect(nomsDitsDans("« Je m'appelle Mabelle Roux », dit-elle.", noms)).toEqual(["a"]);
    expect(nomsDitsDans("« Appelle-moi Mabelle. »", noms)).toEqual(["a"]);
    expect(nomsDitsDans("Il se présente : Wil.", noms)).toEqual(["b"]);
    expect(nomsDitsDans("Al Brann te salue.", noms)).toEqual(["c"]);
  });

  it("ni un mot dans un autre, ni un prénom trop court", () => {
    expect(nomsDitsDans("Elle te tend un verre de mabellerie.", noms)).toEqual([]);
    expect(nomsDitsDans("Al, au fond, rit.", noms)).toEqual([]);
    expect(nomsDitsDans("L'aubergiste essuie le comptoir.", noms)).toEqual([]);
  });
});
