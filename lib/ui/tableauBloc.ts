/**
 * V3.1-66 — noyau pur du bloc Tableau : ajouter et retirer lignes et colonnes.
 *
 * Les cellules d'une ligne sont rangées PAR NOM DE COLONNE (forme figée du
 * schéma `customTable`). Deux colonnes de même nom se confondraient et
 * s'écraseraient : toute opération qui nomme une colonne passe donc par
 * `nomColonneUnique`, qui suffixe (« Prix », « Prix 2 », « Prix 3 »).
 */

import type { CustomTableBlockData } from "@/src/core/schemas/blocks/customTable";

type Ligne = CustomTableBlockData["rows"][number];

/** `nom` s'il est libre, sinon `nom 2`, `nom 3`… `ignorer` : l'indice de la colonne qu'on renomme (elle ne compte pas contre elle-même). */
export function nomColonneUnique(nom: string, colonnes: readonly string[], ignorer?: number): string {
  const autres = new Set(colonnes.filter((_, i) => i !== ignorer));
  if (!autres.has(nom)) return nom;
  let n = 2;
  while (autres.has(`${nom} ${n}`)) n += 1;
  return `${nom} ${n}`;
}

/** Texte d'une cellule : une valeur absente ou non textuelle s'affiche vide. */
export function valeurCellule(ligne: Ligne, colonne: string): string {
  const v = ligne[colonne];
  return typeof v === "string" ? v : "";
}

export function ajouterColonne(data: CustomTableBlockData): CustomTableBlockData {
  const nom = nomColonneUnique(`Colonne ${data.columns.length + 1}`, data.columns);
  return { ...data, columns: [...data.columns, nom] };
}

export function retirerColonne(data: CustomTableBlockData, index: number): CustomTableBlockData {
  const nom = data.columns[index];
  if (nom === undefined) return data;
  const rows = data.rows.map((ligne) => {
    const reste = { ...ligne };
    delete reste[nom];
    return reste;
  });
  return { ...data, columns: data.columns.filter((_, i) => i !== index), rows };
}

/**
 * Renomme une colonne en emportant les valeurs de ses cellules. Un nom déjà
 * pris reçoit un suffixe. Un nom vide (ou fait d'espaces) laisse la donnée
 * telle quelle : le schéma exige au moins un caractère.
 */
export function renommerColonne(data: CustomTableBlockData, index: number, nom: string): CustomTableBlockData {
  const ancien = data.columns[index];
  const propre = nom.trim();
  if (ancien === undefined || propre === "") return data;
  const final = nomColonneUnique(propre, data.columns, index);
  if (final === ancien) return data;
  const rows = data.rows.map((ligne) => {
    if (!Object.hasOwn(ligne, ancien)) return ligne;
    const { [ancien]: valeur, ...reste } = ligne;
    return { ...reste, [final]: valeur };
  });
  return { ...data, columns: data.columns.map((c, i) => (i === index ? final : c)), rows };
}

export function ajouterLigne(data: CustomTableBlockData): CustomTableBlockData {
  return { ...data, rows: [...data.rows, {}] };
}

export function retirerLigne(data: CustomTableBlockData, index: number): CustomTableBlockData {
  return { ...data, rows: data.rows.filter((_, i) => i !== index) };
}

export function modifierCellule(
  data: CustomTableBlockData,
  indexLigne: number,
  colonne: string,
  valeur: string,
): CustomTableBlockData {
  return {
    ...data,
    rows: data.rows.map((ligne, i) => (i === indexLigne ? { ...ligne, [colonne]: valeur } : ligne)),
  };
}
