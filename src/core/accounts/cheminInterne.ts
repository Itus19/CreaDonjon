/**
 * AG-6 — un chemin de retour n'est suivi que s'il reste dans l'app.
 *
 * « Voir comme » retient la page d'où l'on part pour y revenir ensuite. Cette
 * adresse vient du navigateur : sans contrôle, `//exemple.com` ou
 * `https://exemple.com` ferait de notre redirection un tremplin vers un autre
 * site (faille de redirection ouverte). On n'accepte donc qu'un chemin
 * absolu de l'app : un seul `/` en tête, ni `\`, ni caractère de contrôle (un
 * navigateur retire tabulations et retours à la ligne, ce qui peut reformer
 * `//`), et une longueur bornée.
 */

const LONGUEUR_MAX = 512;

export function cheminInterne(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  if (valeur.length === 0 || valeur.length > LONGUEUR_MAX) return null;
  if (!valeur.startsWith("/") || valeur.startsWith("//")) return null;
  if (valeur.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(valeur)) return null;
  return valeur;
}
