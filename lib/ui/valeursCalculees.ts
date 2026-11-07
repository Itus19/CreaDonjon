/**
 * V3.1-157 — ce que l'écran montre des valeurs calculées par `characterSheet()`
 * (ADR 0074) : dés de bonus, plage de critique, sens, vitesses spéciales.
 *
 * Logique pure : aucun libellé de phrase ici (ils vivent dans `messages/`),
 * seulement des assemblages de nombres et de dés. Rien n'est recalculé : tout
 * vient de la fiche déjà chargée.
 */
import { ftToM } from "@/src/core/rules/encumbrance";
import type { BonusDie, DerivedSheet, Source } from "@/src/core/rules/sheet";

/** Un nombre signé : « +3 », « -1 » (le signe moins ordinaire, comme le reste de la fiche). */
export function signe(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

/** Les dés de bonus : « 1d4 », « 1d4 + 1d6 ». Vide s'il n'y en a pas. */
export function desEnTexte(dice: readonly BonusDie[]): string {
  return dice.map((d) => `${d.count}d${d.faces}`).join(" + ");
}

/** « +3 + 1d4 » quand des dés s'ajoutent, « +3 » sinon. */
export function bonusAvecDes(mod: number, dice: readonly BonusDie[]): string {
  return dice.length === 0 ? signe(mod) : `${signe(mod)} + ${desEnTexte(dice)}`;
}

/** Le complément d'une formule de jet (« +1d4 »), vide sans dés : il se colle derrière « 1d20+5 ». */
export function complementDes(dice: readonly BonusDie[]): string {
  return dice.length === 0 ? "" : `+${dice.map((d) => `${d.count}d${d.faces}`).join("+")}`;
}

/** Les sources des dés, une par ligne (« Bénédiction : 1d4 »), pour le survol. Vide sans dés. */
export function sourcesDesTexte(dice: readonly BonusDie[]): string {
  return dice.map((d) => `${d.label} : ${d.count}d${d.faces}`).join("\n");
}

/** Les sources d'un nombre, une par ligne (« Rage +2 »). */
export function sourcesNombresTexte(sources: readonly Source[]): string {
  return sources.map((s) => `${s.label} ${signe(s.value)}`).join("\n");
}

/** Le texte du survol d'un jet : son intitulé, puis les sources de ses dés (s'il y en a). */
export function titreAvecDes(intitule: string, dice: readonly BonusDie[]): string {
  return dice.length === 0 ? intitule : `${intitule}\n${sourcesDesTexte(dice)}`;
}

/** La plage de critique à annoncer (« 19-20 »), ou `null` si c'est le 20 seul. */
export function plageCritique(critRange: number): string | null {
  return critRange < 20 ? `${Math.max(2, critRange)}-20` : null;
}

export type CleVitesse = keyof NonNullable<DerivedSheet["speeds"]>;
export type CleSens = keyof NonNullable<DerivedSheet["senses"]>;

export interface LigneSensVitesse {
  genre: "vitesse" | "sens";
  /** `fly`, `darkvision`… : la clé de libellé dans `messages/`. */
  cle: string;
  /** Déjà en mètres, arrondi comme la vitesse de l'en-tête (au mètre). */
  metres: number;
  /** Les sources, pour le survol. */
  sources: string;
}

const ORDRE_VITESSES = ["fly", "swim", "climb", "burrow"] as const;
const ORDRE_SENS = ["darkvision", "blindsight", "tremorsense", "truesight"] as const;

/** Les vitesses spéciales (pieds -> mètres) puis les sens (déjà en mètres) que la fiche porte ; vide si aucun. */
export function lignesSensVitesses(sheet: Pick<DerivedSheet, "speeds" | "senses">): LigneSensVitesse[] {
  const lignes: LigneSensVitesse[] = [];
  for (const cle of ORDRE_VITESSES) {
    const v = sheet.speeds[cle];
    if (v) lignes.push({ genre: "vitesse", cle, metres: Math.round(ftToM(v.value)), sources: sourcesNombresTexte(v.sources) });
  }
  for (const cle of ORDRE_SENS) {
    const v = sheet.senses[cle];
    if (v) lignes.push({ genre: "sens", cle, metres: Math.round(v.value), sources: sourcesNombresTexte(v.sources) });
  }
  return lignes;
}
