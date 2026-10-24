import { rollsForDisplay } from "@/src/core/dice/diceTool";
import { weaponAttackAbilityMod } from "@/src/core/rules/action";
import type { TraceStep } from "@/src/core/formula/evaluate";
import type { WeaponData } from "@/src/core/rules/srdMapping";
import { sortieSansDes, type SortieJet } from "@/lib/ui/outilDes";
import type { GenreSort } from "@/lib/ui/initiative";

/**
 * Logique pure des boutons d'attaque, de dégâts et de sort de la fiche
 * (V3.1-106) : ils ouvrent l'outil de dés au lieu de lancer directement. Rien
 * ici ne lance un dé ni ne tranche une règle (règle 8) : on décrit ce que le
 * serveur lancera et on met en forme ce qu'il a rendu (dés, paire d'avantage,
 * d20 gardé, par `rollsForDisplay`).
 */

/** « 1d8 » + 3 -> « 1d8+3 », omis si nul. */
export function formuleAvecModificateur(base: string, modificateur: number): string {
  if (modificateur === 0) return base;
  return `${base}${modificateur > 0 ? "+" : ""}${modificateur}`;
}

/** Une arme équipée, telle que l'outil de dés la décrit. */
export interface ArmeFiche {
  itemId: string;
  nom: string;
  /** Modificateur du d20 affiché dans la grille (même règle que la carte d'arme ; le serveur recalcule). */
  modificateurAttaque: number;
  /** Les dégâts à une main, modificateur compris : « 1d8+3 ». */
  formuleDegats: string;
  /** À deux mains (propriété polyvalente), `null` sinon. */
  formuleDeuxMains: string | null;
}

export function armeFiche(params: {
  itemId: string;
  nom: string;
  weapon: WeaponData;
  strMod: number;
  dexMod: number;
  proficiencyBonus: number;
}): ArmeFiche {
  const { weapon } = params;
  const mod = weaponAttackAbilityMod(weapon.properties, weapon.isRanged, params.strMod, params.dexMod);
  return {
    itemId: params.itemId,
    nom: params.nom,
    modificateurAttaque: mod + params.proficiencyBonus,
    formuleDegats: formuleAvecModificateur(weapon.damageDice, mod),
    formuleDeuxMains: weapon.versatileDamageDice ? formuleAvecModificateur(weapon.versatileDamageDice, mod) : null,
  };
}

/** Un sort préparé, tel que l'outil de dés le décrit. */
export interface SortFiche {
  spellKey: string;
  nom: string;
  /** Niveau de l'emplacement choisi sur la carte (0 : sort mineur, sans emplacement). */
  niveauLance: number;
  /** Les dégâts (ou le soin) au niveau choisi, `null` pour un sort utilitaire. */
  formuleDegats: string | null;
  /** Ce que le sort sait faire contre une cible (`classerSort`) ; `null` : rien de ciblable. */
  genre: GenreSort | null;
  /** Bonus du d20 d'attaque de sort affiché dans la grille. */
  modificateurAttaque: number;
}

// ---- ce que le serveur a rendu -------------------------------------------------

interface JetRendu {
  total: number;
  trace: TraceStep[];
}

interface Contexte {
  who: string;
  what: string;
}

/**
 * Une attaque de la fiche : les dés, la paire d'avantage, le d20 gardé. Il n'y a
 * pas de CA à battre ici (la fiche ne vise personne) : seul un 20 naturel
 * (réussite, or) ou un 1 naturel (échec) colore la case.
 */
export function sortieAttaque(attack: JetRendu & { isCritical: boolean; isCriticalFail: boolean }, contexte: Contexte): SortieJet {
  const affiche = rollsForDisplay([attack]);
  return {
    ...contexte,
    chips: [],
    total: affiche?.total ?? attack.total,
    dc: null,
    verdict: attack.isCritical ? "success" : attack.isCriticalFail ? "fail" : null,
    hidden: false,
    trace: affiche?.trace ?? [],
    pair: affiche?.pair ?? null,
    naturalD20: affiche?.naturalD20 ?? null,
    dcPrivate: false,
  };
}

/** Des dégâts de la fiche : les dés, sans verdict (un jet de dégâts ne réussit ni n'échoue). */
export function sortieDegats(damage: JetRendu, contexte: Contexte): SortieJet {
  const affiche = rollsForDisplay([damage]);
  return {
    ...contexte,
    chips: [],
    total: affiche?.total ?? damage.total,
    dc: null,
    verdict: null,
    hidden: false,
    trace: affiche?.trace ?? [],
    pair: null,
    naturalD20: null,
    dcPrivate: false,
  };
}

/** Un sort lancé : ses dégâts s'il en a, sinon un texte seul (l'emplacement est dépensé, rien à montrer). */
export function sortieSort(damage: JetRendu | undefined, contexte: Contexte, texteSansDegats: string): SortieJet {
  return damage ? sortieDegats(damage, contexte) : sortieSansDes(contexte.who, texteSansDegats);
}

/** Le 1 naturel rate toujours : la bande ne propose pas les dégâts. Sinon la table juge de la touche (aucune CA ici). */
export function degatsProposes(attack: { isCriticalFail: boolean }): boolean {
  return !attack.isCriticalFail;
}

/** Les sorts qui se ciblent avec « Cibler » : l'attaque (dégâts compris), la sauvegarde de la cible, le soin. */
export function genreCiblableDuLancer(genre: GenreSort | null): "spell_save" | "heal" | null {
  return genre === "spell_save" || genre === "heal" ? genre : null;
}
