import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Mot de passe optionnel sur un lien de partage (V1-C4,
 * specs/arbitrage-modifications.md §3.2). Contrairement au jeton
 * (`token.ts`, 256 bits aleatoires — un simple SHA-256 suffit), un mot de
 * passe choisi par un humain est une entree faible : il exige un hachage
 * lent et sale. `scrypt` (node:crypto, natif) evite une nouvelle
 * dependance pour ce seul besoin. Format auto-descriptif
 * "scrypt$<sel hex>$<hachage hex>" pour permettre un futur changement
 * d'algorithme sans migration de donnees.
 */
const KEY_LENGTH = 64;

export function hashSharePassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifySharePassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
