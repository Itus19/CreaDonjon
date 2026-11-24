/**
 * AG-18 (ADR 0106) — la copie d'un ruleset propre à un monde, et ce qui a
 * changé dans sa source depuis.
 *
 * Une règle se reconnaît à son empreinte : un condensé, calculé par la base,
 * de toutes les surcharges d'une `entry_key` dans un ruleset. La copie garde
 * la « référence » : l'empreinte de chaque règle de la source au moment de la
 * copie, ou du dernier choix. Une règle dont l'empreinte de la source diffère
 * de la référence a changé dans la source. Les retouches faites dans la copie
 * elle-même n'entrent pas dans la comparaison : elles ne sont pas une mise à
 * jour.
 */

/** Une règle d'un ruleset : sa clé, l'empreinte de ses surcharges, son nom lisible. */
export interface EmpreinteRegle {
  entryKey: string;
  digest: string;
  label: string;
}

/** `entry_key` → empreinte de la source, au moment de la copie ou du dernier choix. */
export type ReferenceCopie = Record<string, string>;

export type EtatRegle = "modifiee" | "nouvelle" | "retiree";

export interface RegleAMettreAJour {
  entryKey: string;
  label: string;
  etat: EtatRegle;
  /** L'empreinte actuelle dans la source ; `null` pour une règle retirée. */
  digest: string | null;
}

/** Lit la colonne `copy_baseline` ; toute valeur illisible compte comme une référence vide. */
export function lireReference(valeur: unknown): ReferenceCopie {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return {};
  return Object.fromEntries(Object.entries(valeur).filter((paire): paire is [string, string] => typeof paire[1] === "string"));
}

/** Les règles de la source qui ont changé depuis la référence, triées par nom. */
export function miseAJourCopie(reference: ReferenceCopie, source: readonly EmpreinteRegle[]): RegleAMettreAJour[] {
  const regles: RegleAMettreAJour[] = [];
  const vues = new Set<string>();
  for (const r of source) {
    vues.add(r.entryKey);
    const avant = reference[r.entryKey];
    if (avant === undefined) regles.push({ entryKey: r.entryKey, label: r.label, etat: "nouvelle", digest: r.digest });
    else if (avant !== r.digest) regles.push({ entryKey: r.entryKey, label: r.label, etat: "modifiee", digest: r.digest });
  }
  for (const cle of Object.keys(reference)) {
    if (!vues.has(cle)) regles.push({ entryKey: cle, label: cle, etat: "retiree", digest: null });
  }
  return regles.sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
