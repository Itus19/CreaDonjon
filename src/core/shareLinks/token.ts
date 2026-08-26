import { randomBytes, createHash } from "node:crypto";

/**
 * Jeton de partage (SCHEMA.md §18) : `hashShareToken` sert a la resolution
 * (`share_links.token_hash`, jamais le jeton en clair compare directement).
 * Le jeton en clair est desormais aussi conserve tel quel dans
 * `share_links.token` (migration 20260826180001, decision explicite —
 * un lien de partage n'ouvre qu'une vue en lecture seule). `node:crypto`
 * est un module natif Node, pas une bibliotheque d'interface/reseau —
 * autorise dans src/core (regle absolue n°14).
 */

/** 32 octets aleatoires encodes en base64url : assez d'entropie pour ne
 * jamais etre devine, court dans une URL. */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hexadecimal — meme fonction cote creation (avant insertion) et
 * cote resolution (comparee a `token_hash` en base). */
export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
