/**
 * Budget de difficulte d'une rencontre de combat (V1-E3,
 * specs/outils-mj.md §4.1, texte officiel SRD 5.2.1 § « Difficulte d'une
 * rencontre de combat »). Deux fonctions pures : `encounterBudget` calcule
 * le budget de PX disponible pour un groupe, `encounterCost` calcule ce
 * qu'une composition de creatures en depense. Aucune conversion CR -> PX
 * ici : chaque creature du SRD porte deja sa valeur en PX (`source_raw.xp`),
 * pas besoin d'une table de correspondance intermediaire qui serait, de
 * toute facon, differente entre les deux editions.
 *
 * Portee : le SRD 5.1 (2014) sous licence dans ce depot NE CONTIENT PAS la
 * table de budget de PX (contenu du Guide du Maitre, jamais republie dans
 * les Regles de base couvertes par la licence libre de cette edition) —
 * seul le ruleset 5.2.1 fournit cette table (voir le script d'ecriture,
 * pas de valeur inventee pour 2014).
 */

export type EncounterBudgetBand = "low" | "moderate" | "high";

export interface EncounterBudgetRow {
  level: number;
  low: number;
  moderate: number;
  high: number;
}

export class EncounterBudgetLevelError extends Error {
  constructor(level: number) {
    super(`Aucun seuil de budget connu pour le niveau ${level}.`);
    this.name = "EncounterBudgetLevelError";
  }
}

/**
 * Budget total de PX pour un groupe : la somme, pour chaque personnage, du
 * seuil de son propre niveau — equivaut a « seuil x nombre de PJ » du texte
 * officiel quand tous les PJ ont le meme niveau, et se generalise sans
 * l'inventer au cas (courant en jeu) d'un groupe de niveaux melanges.
 */
export function encounterBudget(
  partyLevels: readonly number[],
  band: EncounterBudgetBand,
  table: readonly EncounterBudgetRow[]
): number {
  return partyLevels.reduce((sum, level) => {
    const row = table.find((r) => r.level === level);
    if (!row) throw new EncounterBudgetLevelError(level);
    return sum + row[band];
  }, 0);
}

/** Cout en PX d'une composition de creatures : `xp` unitaire (deja fourni par le SRD) multiplie par le nombre de creatures, somme sur tous les participants. */
export function encounterCost(participants: readonly { xp: number; count: number }[]): number {
  return participants.reduce((sum, p) => sum + p.xp * p.count, 0);
}

/**
 * Convertit les lignes brutes d'un bloc `custom_table` (en-tetes francais
 * "Niveau"/"Faible"/"Modérée"/"Élevée", memes cles que les colonnes
 * affichees — `components/rules/layouts/Table.tsx` lit `row[colonne]`
 * directement) en lignes typees. Une ligne dont un champ numerique ne se
 * parse pas est ignoree plutot que de produire `NaN` en silence — jamais
 * une donnee invalide propagee dans un budget affiche au MJ.
 */
export function parseEncounterBudgetRows(rows: readonly Record<string, unknown>[]): EncounterBudgetRow[] {
  const result: EncounterBudgetRow[] = [];
  for (const row of rows) {
    const level = Number(row["Niveau"]);
    const low = Number(row["Faible"]);
    const moderate = Number(row["Modérée"]);
    const high = Number(row["Élevée"]);
    if ([level, low, moderate, high].some((n) => !Number.isFinite(n))) continue;
    result.push({ level, low, moderate, high });
  }
  return result;
}
