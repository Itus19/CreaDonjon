import { describe, expect, it } from "vitest";
import { signPasswordProof, verifyPasswordProof } from "./access";

const HASH = "scrypt$sel$empreinte-du-mot-de-passe";
const TOKEN = "jeton-du-lien";
const NOW = 1_800_000_000_000;
const SIX_HEURES = 6 * 3600 * 1000;

describe("preuve d'accès à un lien de partage protégé (V3.1-142)", () => {
  it("une preuve posée par le serveur est acceptée jusqu'à son échéance", () => {
    const valeur = signPasswordProof(HASH, TOKEN, NOW + SIX_HEURES);
    expect(verifyPasswordProof(valeur, HASH, TOKEN, NOW)).toBe(true);
    expect(verifyPasswordProof(valeur, HASH, TOKEN, NOW + SIX_HEURES - 1)).toBe(true);
  });

  it("la valeur « 1 » d'avant est refusée : elle se forgeait sans rien savoir", () => {
    expect(verifyPasswordProof("1", HASH, TOKEN, NOW)).toBe(false);
  });

  it("une preuve échue est refusée", () => {
    const valeur = signPasswordProof(HASH, TOKEN, NOW + SIX_HEURES);
    expect(verifyPasswordProof(valeur, HASH, TOKEN, NOW + SIX_HEURES)).toBe(false);
  });

  it("changer le mot de passe invalide les preuves déjà posées", () => {
    const valeur = signPasswordProof(HASH, TOKEN, NOW + SIX_HEURES);
    expect(verifyPasswordProof(valeur, "scrypt$sel$nouveau-mot-de-passe", TOKEN, NOW)).toBe(false);
  });

  it("une preuve pour un lien ne vaut pas pour un autre", () => {
    const valeur = signPasswordProof(HASH, TOKEN, NOW + SIX_HEURES);
    expect(verifyPasswordProof(valeur, HASH, "autre-jeton", NOW)).toBe(false);
  });

  it("repousser l'échéance à la main casse la signature", () => {
    const [, signature] = signPasswordProof(HASH, TOKEN, NOW + SIX_HEURES).split(".");
    expect(verifyPasswordProof(`${NOW + 10 * SIX_HEURES}.${signature}`, HASH, TOKEN, NOW)).toBe(false);
  });

  it("une valeur absente ou mal formée est refusée", () => {
    for (const v of [undefined, "", ".", "abc.def", `${NOW + SIX_HEURES}.`, `${NOW + SIX_HEURES}.zz`]) {
      expect(verifyPasswordProof(v, HASH, TOKEN, NOW)).toBe(false);
    }
  });
});
