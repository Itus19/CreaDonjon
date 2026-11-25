/**
 * Dérive une graine d'une autre (specs/generation-du-monde.md §4.2).
 *
 * C'est ce qui permet de ne rien stocker : la graine de l'aubergiste se
 * recalcule à partir de la graine de la ville, de l'identifiant du lieu, du
 * rôle et du rang. Même entrée, même graine, donc même personne.
 *
 * FNV-1a sur 32 bits : court, sans dépendance, bien réparti pour des clés
 * courtes. Pas d'usage cryptographique (comme `SeededRng`). Les parties sont
 * séparées par un caractère de contrôle (U+001F) pour que « ab » + « c » ne
 * donne pas la même graine que « a » + « bc ».
 */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SEPARATOR = "\u001f";

export function deriveSeed(parent: number, ...parts: readonly (string | number)[]): number {
  if (!Number.isInteger(parent) || parent < 0 || parent > 0xffffffff) {
    throw new RangeError("La graine parente doit être un entier de 0 à 2^32 - 1");
  }
  const text = [String(parent), ...parts.map(String)].join(SEPARATOR);
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}
