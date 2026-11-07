/**
 * V3.1-164 (proposition B de l'esquisse du 7 novembre) : les six cases de
 * l'étape Caractéristiques écrivent « d'où vient le total » en une addition
 * en couleurs (« 15 +2 »), et une légende sous les cases nomme chaque
 * couleur une seule fois. Avant, chaque source s'écrivait en phrase dans la
 * case et débordait.
 *
 * La première source d'une case est sa base (valeur attribuée, tirée,
 * achetée) : grise, nommée dans la légende sans couleur. Chaque autre source
 * reçoit un numéro de couleur, le même dans toutes les cases où elle revient.
 * Les sources viennent de la fiche du moteur ; rien n'est recalculé ici.
 */
export interface SourceCase {
  label: string;
  value: number;
}

export type SourcesParCase = Partial<Record<string, readonly SourceCase[]>>;

export interface LegendeSources {
  /** Les libellés de base distincts, dans l'ordre d'apparition. */
  bases: string[];
  /** Les sources de bonus et leur numéro de couleur. */
  bonus: { label: string; couleur: number }[];
  couleurDe: (label: string) => number;
}

/** Le nombre de couleurs de bonus que l'écran sait dessiner. */
export const COULEURS_DE_BONUS = 5;

export function legendeSources(cases: SourcesParCase, nombreDeCouleurs: number = COULEURS_DE_BONUS): LegendeSources {
  const bases: string[] = [];
  const bonus: { label: string; couleur: number }[] = [];
  for (const sources of Object.values(cases)) {
    if (!sources) continue;
    sources.forEach((s, i) => {
      if (i === 0) {
        if (!bases.includes(s.label)) bases.push(s.label);
      } else if (!bonus.some((b) => b.label === s.label)) {
        bonus.push({ label: s.label, couleur: bonus.length % nombreDeCouleurs });
      }
    });
  }
  return {
    bases,
    bonus,
    couleurDe: (label) => bonus.find((b) => b.label === label)?.couleur ?? 0,
  };
}
