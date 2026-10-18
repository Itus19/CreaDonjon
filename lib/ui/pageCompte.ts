import { sectionsCompte, type DonneesCompte, type SectionCompte } from "./compte";

/** Les parties non nulles de la ligne de contexte « MJ d'un monde · joueur dans trois » ; les zéros sont omis. */
export function partiesContexte(contexte: DonneesCompte["contexte"]): { cle: "mene" | "joue" | "solo"; nombre: number }[] {
  const toutes = [
    { cle: "mene", nombre: contexte.mene },
    { cle: "joue", nombre: contexte.joue },
    { cle: "solo", nombre: contexte.solo },
  ] as const;
  return toutes.filter((p) => p.nombre > 0).map((p) => ({ cle: p.cle, nombre: p.nombre }));
}

/** Les entrées du sommaire : les sections décidées, Apparence seulement si elle est fournie (V3.1-81). */
export function entreesSommaire(params: { aRejointParUnLien: boolean; avecApparence: boolean }): SectionCompte[] {
  return sectionsCompte({ aRejointParUnLien: params.aRejointParUnLien }).filter(
    (s) => s !== "apparence" || params.avecApparence,
  );
}

/** L'entrée à allumer : la première section visible dans l'ordre de la page, sinon l'actuelle. */
export function sectionActive<T extends string>(ordre: readonly T[], visibles: ReadonlySet<T>, actuelle: T): T {
  return ordre.find((s) => visibles.has(s)) ?? actuelle;
}

export function motsDePasseDifferents(premier: string, second: string): boolean {
  return premier !== second;
}

export function confirmationValide(saisie: string, motAttendu: string): boolean {
  return saisie === motAttendu;
}
