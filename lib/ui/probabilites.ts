import { PROBABILITY_DC_MAX, PROBABILITY_DC_MIN } from "@/src/core/rules/probability";
import type { Ability } from "@/src/core/rules/abilities";

/** Le DD toujours dans [5, 30], entier ; une valeur qui n'est pas un nombre retombe sur le minimum. */
export function bornerDd(valeur: number): number {
  if (!Number.isFinite(valeur)) return PROBABILITY_DC_MIN;
  return Math.min(PROBABILITY_DC_MAX, Math.max(PROBABILITY_DC_MIN, Math.round(valeur)));
}

/** Abréviation française de la colonne « caractéristique » de la matrice. */
export const ABREVIATION_CARAC: Record<Ability, string> = {
  str: "FOR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "SAG",
  cha: "CHA",
};

/** Un modificateur avec son signe : « +3 », « -1 ». */
export function signe(valeur: number): string {
  return valeur >= 0 ? `+${valeur}` : String(valeur);
}

/**
 * Les noms des colonnes de la matrice : courts mais toujours distincts.
 * Les mots communs en tête de TOUS les noms (« PJ Testeuse A », « PJ Testeur
 * B ») sont retirés ; le premier mot restant suffit s'il distingue chacun ;
 * sinon on prend le dernier mot. Au téléphone (`abreger`), chaque nom est
 * tronqué à la plus courte longueur (4 lettres au moins) qui les garde tous
 * distincts.
 */
export function nomsCourts(noms: readonly string[], abreger: boolean): string[] {
  const mots = noms.map((n) => n.trim().split(/\s+/).filter(Boolean));
  let commun = 0;
  if (mots.length > 1) {
    while (mots.every((m) => m.length > commun + 1 && m[commun] === mots[0][commun])) commun++;
  }
  const restes = mots.map((m) => m.slice(commun));
  const distincts = (liste: string[]) => new Set(liste).size === liste.length;
  const premiers = restes.map((m) => m[0] ?? "");
  const courts = distincts(premiers) ? premiers : restes.map((m) => m[m.length - 1] ?? "");
  if (!abreger) return courts;
  const plusLong = Math.max(0, ...courts.map((c) => Array.from(c).length));
  for (let n = 4; n < plusLong; n++) {
    const essai = courts.map((c) => Array.from(c).slice(0, n).join(""));
    if (distincts(essai)) return essai;
  }
  return courts;
}
