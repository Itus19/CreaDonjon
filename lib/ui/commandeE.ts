/**
 * Commande E (V3.1-26) : la pastille du milieu d'une jauge reçoit un écart,
 * ▲ l'ajoute, ▼ le retire. Fonctions pures, sorties de `CommandeE.tsx` pour
 * être testables sans navigateur.
 */

/**
 * L'écart à envoyer pour un geste sur ▲ (`signe` = 1) ou ▼ (`signe` = -1).
 *
 * - champ vide (ou d'espaces) : ±1 ;
 * - un entier (« 250 », « 7 », « +3 ») : ±ce nombre. Un « - » tapé est ignoré,
 *   car le sens est donné par la flèche, jamais par le signe saisi ;
 * - tout le reste (lettres, décimale, zéro, énorme nombre) : `null`, on
 *   n'envoie rien et le champ garde ce que la personne a tapé.
 *
 * Le résultat est un ÉCART : le composant ne calcule jamais la nouvelle
 * valeur, c'est le serveur qui l'applique et la borne.
 */
export function ecartCommandeE(champ: string, signe: 1 | -1): number | null {
  const texte = champ.trim();
  if (texte === "") return signe;
  if (!/^[+-]?\d+$/.test(texte)) return null;
  const montant = Math.abs(Number(texte));
  if (montant === 0 || !Number.isSafeInteger(montant)) return null;
  return signe * montant;
}

/** Danger des points de vie : strictement sous un tiers du maximum (jamais sans maximum). */
export function pvSousUnTiers(courants: number, maximum: number): boolean {
  return maximum > 0 && courants * 3 < maximum;
}
