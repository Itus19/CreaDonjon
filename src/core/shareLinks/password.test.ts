import { describe, expect, it } from "vitest";
import { hashSharePassword, verifySharePassword } from "./password";

describe("hashSharePassword / verifySharePassword", () => {
  it("verifie un mot de passe correct", () => {
    const hash = hashSharePassword("secret-de-partie");
    expect(verifySharePassword("secret-de-partie", hash)).toBe(true);
  });

  it("rejette un mot de passe incorrect", () => {
    const hash = hashSharePassword("secret-de-partie");
    expect(verifySharePassword("mauvais-mot-de-passe", hash)).toBe(false);
  });

  it("ne stocke jamais le mot de passe en clair", () => {
    const hash = hashSharePassword("secret-de-partie");
    expect(hash).not.toContain("secret-de-partie");
  });

  it("genere un sel different a chaque appel, meme pour le meme mot de passe", () => {
    const a = hashSharePassword("secret-de-partie");
    const b = hashSharePassword("secret-de-partie");
    expect(a).not.toBe(b);
  });

  it("rejette une valeur stockee malformee sans planter", () => {
    expect(verifySharePassword("secret-de-partie", "pas-le-bon-format")).toBe(false);
  });
});
