import { z } from "zod";

/**
 * « Rejoindre une table » (V3.1-35) : on colle le lien d'invitation reçu du
 * MJ. Ce module en tire le jeton, sans rien deviner : un lien complet (quel
 * que soit l'hôte : local, hébergé), un chemin `/rejoindre/…`, ou le jeton
 * seul. Tout le reste n'est pas une invitation.
 */

/** Un jeton : lettres, chiffres, `-` et `_`, d'une longueur raisonnable. */
const JETON = /^[A-Za-z0-9_-]{8,200}$/;

export function jetonDepuisLien(texte: string): string | null {
  const brut = texte.trim();
  if (brut.length === 0 || brut.length > 2000) return null;
  const sansSuite = brut.split(/[?#]/)[0];
  const morceaux = sansSuite.split("/").filter((m) => m.length > 0);
  const index = morceaux.indexOf("rejoindre");
  const candidat = index >= 0 ? morceaux[index + 1] : morceaux.length === 1 ? morceaux[0] : undefined;
  return candidat !== undefined && JETON.test(candidat) ? candidat : null;
}

/** Corps de `POST /api/invitations/verifier`. */
export const verifierLienSchema = z.object({
  lien: z.string().min(1).max(2000),
});
