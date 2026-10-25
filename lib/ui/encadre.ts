/**
 * V3.1-66 — noyau pur du bloc Encadré : les opérations sur ses lignes et les
 * suggestions d'intitulés. Le composant ne fait que brancher ; ce qui se
 * décide (ordre, doublons, filtre) vit ici, testé sans navigateur.
 */

import type { InfoboxBlockData, InfoboxEntry } from "@/src/core/schemas/blocks/infobox";

/** Minuscules sans accents : « Région » et « region » se valent pour le filtre. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Les intitulés proposés pour une fiche.
 *
 * - `parGenre` : la constante des libellés, clé = `entityKind` ;
 * - un genre sans liste (ou absent) ne propose rien ;
 * - `saisie` filtre (contient, sans accents ni casse) ; vide = tout le genre ;
 * - `deja` : les intitulés des AUTRES lignes, jamais reproposés ;
 * - une suggestion identique à la saisie n'est plus une suggestion.
 */
export function suggererIntitules(
  parGenre: Readonly<Record<string, readonly string[]>>,
  entityKind: string | null | undefined,
  saisie: string,
  deja: readonly string[],
): string[] {
  if (!entityKind || !Object.hasOwn(parGenre, entityKind)) return [];
  const filtre = normaliser(saisie);
  const pris = new Set(deja.map(normaliser));
  return parGenre[entityKind].filter((intitule) => {
    const n = normaliser(intitule);
    if (pris.has(n)) return false;
    if (filtre === "") return true;
    return n !== filtre && n.includes(filtre);
  });
}

export function ajouterLigne(data: InfoboxBlockData, intitule = ""): InfoboxBlockData {
  return { ...data, entries: [...data.entries, { label: intitule, value: "" }] };
}

export function retirerLigne(data: InfoboxBlockData, index: number): InfoboxBlockData {
  return { ...data, entries: data.entries.filter((_, i) => i !== index) };
}

export function modifierLigne(
  data: InfoboxBlockData,
  index: number,
  patch: Partial<InfoboxEntry>,
): InfoboxBlockData {
  return { ...data, entries: data.entries.map((e, i) => (i === index ? { ...e, ...patch } : e)) };
}

/** Déplace la ligne `de` à la place `vers` (les autres se décalent). Indices hors bornes : donnée inchangée. */
export function deplacerLigne(data: InfoboxBlockData, de: number, vers: number): InfoboxBlockData {
  const n = data.entries.length;
  if (de === vers || de < 0 || vers < 0 || de >= n || vers >= n) return data;
  const entries = [...data.entries];
  const [ligne] = entries.splice(de, 1);
  entries.splice(vers, 0, ligne);
  return { ...data, entries };
}
