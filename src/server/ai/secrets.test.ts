import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { chiffrerSecret, dechiffrerSecret, chiffrementDisponible, SecretKeyAbsente } = await import("./secrets");

/** V3.1-224 (ADR 0103) — la clé d'un compte ne doit jamais reposer en clair. */
describe("le chiffrement d'une clé d'API", () => {
  const CLE = "a".repeat(64);
  let avant: string | undefined;

  beforeEach(() => {
    avant = process.env.AI_SECRETS_KEY;
    process.env.AI_SECRETS_KEY = CLE;
  });
  afterEach(() => {
    if (avant === undefined) delete process.env.AI_SECRETS_KEY;
    else process.env.AI_SECRETS_KEY = avant;
  });

  it("chiffre puis redonne la même clé", () => {
    const secret = "sk-venice-exemple-0123456789";
    expect(dechiffrerSecret(chiffrerSecret(secret))).toBe(secret);
  });

  it("ne laisse jamais le secret lisible dans ce qu'il stocke", () => {
    const blob = chiffrerSecret("sk-venice-exemple-0123456789");
    expect(blob).not.toContain("venice");
    expect(blob).not.toContain("0123456789");
    expect(blob.startsWith("v1:")).toBe(true);
  });

  it("deux chiffrements du même secret ne se ressemblent pas (vecteur d'initialisation neuf)", () => {
    expect(chiffrerSecret("pareil")).not.toBe(chiffrerSecret("pareil"));
  });

  it("refuse de déchiffrer ce qui a été altéré — l'authentification GCM le voit", () => {
    const blob = chiffrerSecret("sk-exemple");
    const parts = blob.split(":");
    const altere = [parts[0], parts[1], parts[2], Buffer.from("autre chose").toString("base64")].join(":");
    expect(dechiffrerSecret(altere)).toBeNull();
  });

  it("rend null, jamais une exception, si la clé de chiffrement a changé", () => {
    const blob = chiffrerSecret("sk-exemple");
    process.env.AI_SECRETS_KEY = "b".repeat(64);
    expect(dechiffrerSecret(blob)).toBeNull();
  });

  it("refuse de chiffrer sans clé posée, et le dit", () => {
    delete process.env.AI_SECRETS_KEY;
    expect(chiffrementDisponible()).toBe(false);
    expect(() => chiffrerSecret("sk-exemple")).toThrow(SecretKeyAbsente);
  });

  it("refuse une clé de chiffrement mal formée", () => {
    process.env.AI_SECRETS_KEY = "trop-court";
    expect(chiffrementDisponible()).toBe(false);
  });
});
