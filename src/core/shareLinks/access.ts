import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * V3.1-142 — la preuve qu'un visiteur a donné le mot de passe d'un lien
 * protégé (lien de partage, lien d'invitation), gardée dans un cookie. Avant, elle valait toujours « 1 » : son nom
 * se calculait à partir du jeton, que le visiteur a forcément, donc il
 * pouvait la poser lui-même et passer outre le mot de passe.
 *
 * Elle est désormais `<échéance>.<signature>`, signée par HMAC-SHA-256 avec
 * pour clé le hash du mot de passe du lien : une valeur que le serveur garde
 * en base et n'envoie jamais au navigateur, propre à chaque lien. Sans elle,
 * aucune preuve ne se fabrique ; et changer le mot de passe change la clé,
 * donc invalide toutes les preuves déjà posées. Aucun secret de plus à
 * configurer.
 */

function signature(passwordHash: string, token: string, expiresAtMs: number): Buffer {
  return createHmac("sha256", passwordHash).update(`${token}.${expiresAtMs}`).digest();
}

export function signPasswordProof(passwordHash: string, token: string, expiresAtMs: number): string {
  return `${expiresAtMs}.${signature(passwordHash, token, expiresAtMs).toString("hex")}`;
}

/** Vraie seulement pour une preuve signée par le serveur, pour CE lien, avec CE mot de passe, et pas encore échue. Comparaison en temps constant. */
export function verifyPasswordProof(value: string | undefined, passwordHash: string, token: string, nowMs: number): boolean {
  if (!value) return false;
  const [rawExpiry, rawSignature, ...reste] = value.split(".");
  if (reste.length > 0 || !rawExpiry || !rawSignature || !/^\d{1,16}$/.test(rawExpiry) || !/^[0-9a-f]{64}$/.test(rawSignature)) return false;
  const expiresAtMs = Number(rawExpiry);
  if (expiresAtMs <= nowMs) return false;
  return timingSafeEqual(Buffer.from(rawSignature, "hex"), signature(passwordHash, token, expiresAtMs));
}
