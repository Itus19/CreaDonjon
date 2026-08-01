import { describe, expect, it } from "vitest";
import { generateShareToken, hashShareToken } from "./token";

describe("generateShareToken", () => {
  it("produit une chaine non vide, sans caracteres reserves d'URL", () => {
    const token = generateShareToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("ne produit jamais deux fois le meme jeton", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
  });
});

describe("hashShareToken", () => {
  it("est deterministe (meme entree, meme hachage)", () => {
    expect(hashShareToken("abc")).toBe(hashShareToken("abc"));
  });

  it("produit un hex SHA-256 connu", () => {
    // sha256("abc") est une valeur de reference publique et stable.
    expect(hashShareToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("des entrees differentes donnent des hachages differents", () => {
    expect(hashShareToken("abc")).not.toBe(hashShareToken("abd"));
  });
});
