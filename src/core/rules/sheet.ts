/**
 * Moteur de fiche derivee (BACKLOG_V1 V1-B1, specs/wiki-liens-et-personnages.md
 * Partie B). Fonction pure : aucune lecture, aucun reseau. L'appelant (couche
 * service, a batir dans un ticket ulterieur) assemble `ResolvedRuleset` en
 * remontant les blocs de regles deja resolus (V1-A4) ; ce module ne connait
 * que des structures deja en memoire.
 *
 * Le contrat §B7 fige `DerivedSheet` avec un champ `sources: Source[]` par
 * valeur numerique — c'est la seule provenance prevue. Il ne prevoit rien
 * pour observer l'annulation avantage/desavantage de la couche 7 (§B4 regle
 * 6), pourtant explicitement testee par un cas dore du ticket. `rollState`
 * est donc un ajout deliberate sur `savingThrows`/`skills`, minimal et
 * directement motive par ce critere — pas une extension gratuite.
 */

import { computeEncumbrance, encumbranceModifiers, type EncumbranceResult } from "./encumbrance";
import type { CharacterRules, MulticlassPrerequisites } from "../schemas/rule-blocks/characterRules";
import type { FreeCast } from "../schemas/rule-blocks/choices";
import { rollDice } from "../dice/roll";
import { computeSpellSlots } from "./spellSlots";
import type { Rng } from "../dice/rng";
import type { ActivationBlockData, RuleResource } from "../schemas/rule-blocks/playable";
import { evaluate } from "../formula/evaluate";
import type { FormulaNode } from "../formula/ast";
import { additiveTerms, containsDice } from "../formula/inspect";

// --- Vocabulaire de base -------------------------------------------------

// Defini dans `abilities.ts` (V3.1-120) : `encumbrance.ts` en a besoin, et
// ce fichier importe `encumbrance.ts`. Reexporte ici pour que tout le code
// qui l'importait de `sheet.ts` continue de le faire.
export { ABILITIES, ABILITY_LABELS, SKILL_ABILITIES, SKILLS, type Ability, type Skill } from "./abilities";
import { ABILITIES, ABILITY_LABELS, SKILL_ABILITIES, SKILLS, type Ability, type Skill } from "./abilities";

// --- Modificateurs et empilement (§B4) -----------------------------------

export type ModifierOp =
  | "add"
  | "set"
  | "min"
  | "max"
  | "advantage"
  | "disadvantage"
  | "proficiency"
  | "expertise"
  /**
   * V3.1-46 : la moitié du bonus de maîtrise, arrondie vers le bas, sur un jet
   * qui n'inclut pas déjà la maîtrise (Touche-à-tout du barde). Cible `check`
   * (tout jet de caractéristique, compétences comprises) ou `check.<car>`.
   */
  | "half_proficiency";

export type StackingRule = "stack" | "highest" | "unique";
export type Layer = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Modifier {
  target: string;
  op: ModifierOp;
  /** Absent pour advantage/disadvantage/proficiency/expertise/half_proficiency — ce sont des drapeaux, pas des montants. */
  value?: number;
  /** Identifiant de provenance stable, ex. "item:ent_4c8a". Sert au regroupement "unique". */
  source: string;
  label: string;
  layer: Layer;
  /** Defaut "stack" si absent. */
  stacking?: StackingRule;
  /** V3.1-121 : `value` est par niveau de personnage (toutes classes), multipliee par `characterSheet()` (Ténacité naine : +1 PV max par niveau). */
  perLevel?: boolean;
  /**
   * V3.1-155 (ADR 0074) : la valeur DÉCLARÉE en formule (`max(1, {ability.cha})`, `1d4`).
   * `characterSheet()` la résout : le nombre va dans `value`, les dés dans `dice`.
   */
  formula?: FormulaNode;
  /** V3.1-155 : les dés de bonus, jamais réduits à un nombre ; lancés par le serveur à chaque jet concerné. */
  dice?: BonusDie[];
}

/** V3.1-155 (ADR 0074) : un dé de bonus (« + 1d4 », Bénédiction), avec sa source. */
export interface BonusDie {
  count: number;
  faces: number;
  label: string;
  source: string;
}

export interface Source {
  label: string;
  value: number;
}

/** Un modificateur tel qu'une fiche de regle generique le declare (bloc `modifiers`, specs/regles-blocs.md) — cible/effet/valeur seulement, jamais source/etiquette/couche : ces trois-la dependent d'OU la fiche est accrochee sur un personnage, jamais de la fiche elle-meme. */
export interface DeclaredModifier {
  target: string;
  op: ModifierOp;
  /** V3.1-155 (ADR 0074) : un nombre, ou une formule évaluée par `characterSheet()`. */
  value?: number | FormulaNode;
  /** V3.1-121 : `value` est par niveau de personnage. Cle `snake_case` : c'est une donnee de fiche (bloc `modifiers`). */
  per_level?: boolean;
}

/**
 * Couche d'un modificateur declare par une aptitude generique
 * (specs/wiki-liens-et-personnages.md §B4), selon la provenance de la
 * feature qui le porte — meme prefixe de source que `extraFeatureKeys` dans
 * `resolvedRuleset.ts`. Un don (accorde par un historique, une amelioration
 * de caracteristique, ou tout futur mecanisme non encore prefixe) vit en
 * couche 5 ("augmentations de caracteristique et dons") ; une aptitude de
 * classe vit en couche 3. Espece/historique restent couche 2/4 mais ne
 * passent pas par cette fonction : leurs modificateurs sont deja produits
 * directement en couche 2/4 par `mapSpeciesModifiers`/`mapBackgroundModifiers`.
 */
/** DD et attaque des sorts : la seule formule du moteur (V3.1-50 : la fiche, les sorts d'un trait et les écrans de choix la partagent). */
export function spellNumbers(abilityMod: number, proficiencyBonus: number): { saveDc: number; attackBonus: number } {
  return { saveDc: 8 + proficiencyBonus + abilityMod, attackBonus: proficiencyBonus + abilityMod };
}

export function layerForFeatureSource(source: string): Layer {
  return source.startsWith("class:") ? 3 : 5;
}

/** Attache source/etiquette/couche a des modificateurs declares (bloc `modifiers` d'une fiche de regle) pour produire de vrais `Modifier[]` consommables par `characterSheet()`. */
export function resolveDeclaredModifiers(
  declared: readonly DeclaredModifier[],
  source: string,
  label: string,
  layer: Layer
): Modifier[] {
  return declared.map((d) => ({
    target: d.target,
    op: d.op,
    ...(typeof d.value === "number" ? { value: d.value } : d.value !== undefined ? { formula: d.value } : {}),
    source,
    label,
    layer,
    ...(d.per_level ? { perLevel: true } : {}),
  }));
}

// --- Prerequis (§B5) ------------------------------------------------------

export interface Prerequisite {
  kind: "ability" | "has_feature" | "level";
  ability?: Ability;
  min?: number;
  key?: string;
}

/** Un sort qu'une aptitude accorde (V3.1-116 : option de lignage, sort choisi d'un don). */
export interface FeatureSpell {
  key: string;
  /** Niveau à partir duquel il est connu : de personnage, ou de `classKey` si l'aptitude vient d'une classe (V3.1-117). */
  atLevel: number;
  classKey?: string;
  /** Caractéristique d'incantation choisie pour cette aptitude. Absente : pas encore choisie. */
  ability?: Ability;
  alwaysPrepared: boolean;
  freeCast?: FreeCast;
}

export interface ResolvedFeature {
  key: string;
  label: string;
  source: string;
  modifiers: Modifier[];
  prerequisites?: Prerequisite[];
  /** V3.1-116 : sorts accordés, filtrés par niveau dans `characterSheet()`. */
  spells?: FeatureSpell[];
  /** V3.1-129 (ADR 0060 §1) : ressources déclarées par la fiche (bloc de règle `resources`), maximum en formule. */
  resources?: RuleResource[];
  /** V3.1-131 : « cette règle se joue » (bloc `activation`), pour l'onglet Actions — lu avec les blocs déjà chargés. */
  activation?: ActivationBlockData;
}

/** Un sort accordé par une aptitude, sur la fiche calculée (V3.1-116). DD et attaque se calculent avec SA caractéristique, pas celle de la classe. */
export interface GrantedSpell {
  key: string;
  featureKey: string;
  /** Libellé de l'aptitude qui l'accorde (« Lignage elfique (Drow) »). */
  label: string;
  ability?: Ability;
  saveDc?: number;
  attackBonus?: number;
  alwaysPrepared: boolean;
  freeCast?: FreeCast;
}

export type Warning =
  | { kind: "unmet_prerequisite"; message: string; featureKey: string }
  /** V3.1-113 : plusieurs classes à emplacements, mais pas de table du multiclassé dans le ruleset. */
  | { kind: "missing_multiclass_table"; message: string }
  /** V3.1-115 : le ruleset n'a pas de fiche de règles de personnage ; plafond et charge ne sont pas appliqués. */
  | { kind: "missing_character_rules"; message: string }
  /** V3.1-129 : le maximum d'une ressource n'a pas pu se calculer (référence inconnue) ; elle compte pour 0. */
  | { kind: "resource_formula"; message: string; featureKey: string }
  /** V3.1-155 : la valeur d'un modificateur en formule n'a pas pu se calculer ; il compte pour 0. */
  | { kind: "modifier_formula"; message: string; source: string };

/** V3.1-129 (ADR 0060 §1) : une ressource du personnage, calculée depuis ses fiches — jamais stockée. */
export interface SheetResource {
  key: string;
  label: Record<string, string>;
  max: number;
  recharge: RuleResource["recharge"];
  /** ADR 0076 (V3.1-183) : regagner une utilisation en dépensant autre chose. */
  regain?: RuleResource["regain"];
  /** Clé de la fiche (ou de l'objet) qui la déclare. */
  source: string;
}

// --- Ruleset resolu et build (§B1-B3) --------------------------------------

export interface ClassSpellcasting {
  ability: Ability;
  /** V3.1-113 (ADR 0045) : `pact` — magie de pacte, réserve séparée d'un seul niveau. Absent : emplacements ordinaires. */
  kind?: "slots" | "pact";
  /** V3.1-113 : poids dans le calcul du multiclassé. Absent : la classe ne compte pas (occultiste, non-lanceur). */
  casterWeight?: { fraction: "full" | "half" | "third"; rounding: "up" | "down" };
  /** Niveau de classe -> niveau d'emplacement -> nombre d'emplacements. */
  slotsByLevel: Record<number, Record<number, number>>;
}

export interface ResolvedClass {
  key: string;
  label: string;
  hitDie: number;
  /**
   * Regle de multiclassage (5e) : seule la premiere classe du personnage
   * accorde des maitrises de jets de sauvegarde. L'appelant fournit quand
   * meme la liste complete ; le moteur decide de l'appliquer ou non selon
   * la position de la classe dans `build.classes`.
   */
  savingThrowProficiencies: readonly Ability[];
  /**
   * V3.1-129 : les colonnes chiffrées de la progression (`class_progression`),
   * par niveau de classe — lues par `column.<clé>` dans le maximum d'une
   * ressource. Seules les lignes qui changent quelque chose ont à y figurer :
   * la dernière ligne atteinte vaut.
   */
  progression?: Record<number, Record<string, number>>;
  spellcasting?: ClassSpellcasting;
  /** V3.1-115 : prérequis pour entrer dans cette classe en multiclassant (bloc `class_basics`). Absent : aucun déclaré. */
  multiclassPrerequisites?: MulticlassPrerequisites;
  /** V3.1-115 : caractéristiques suggérées pour cette classe (bloc `class_basics`), affichées à la répartition. */
  suggestedAbilities?: Ability[];
}

export interface ResolvedRuleset {
  classes: Record<string, ResolvedClass>;
  features: Record<string, ResolvedFeature>;
  /** V3.1-115 (ADR 0046) : les règles de personnage du ruleset (plafonds, charge…). Absentes : la fiche le signale, sans inventer de valeur. */
  characterRules?: CharacterRules;
}

export interface ClassLevel {
  key: string;
  level: number;
  subclass?: string;
  /**
   * PV gagnes niveau par niveau au-dela du tout premier niveau du
   * personnage (V2-G1, jet de de de vie) — dans l'ORDRE d'acquisition,
   * jamais recalcules : un jet est un fait qui s'est produit, pas une
   * valeur derivable. Absent ou plus court que le nombre de niveaux
   * concernes = personnage anterieur a cette fonctionnalite ou niveaux pas
   * encore joues ; `computeHitPoints` comble alors avec la moyenne, exactement
   * le calcul d'avant (aucun changement pour les personnages existants).
   */
  hpRolls?: number[];
}

export interface CharacterBuild {
  species: string;
  background?: string;
  classes: ClassLevel[];
  abilities: { assigned: Record<Ability, number> };
  /** Cles resolues (espece, historique, classe, dons) presentes dans `ruleset.features`. */
  featureKeys: string[];
  /** Reponses aux choix, cles qualifiees par origine (§B2), ex. "fighter.l1.c1". */
  choices?: Record<string, unknown>;
}

export interface EquippedItem {
  key: string;
  label: string;
  equipped: boolean;
  modifiers: Modifier[];
  /** V3.1-129 : ressources déclarées par l'objet (Bâton de charges) ; comptées équipé, et lié s'il demande un lien. */
  resources?: RuleResource[];
  requiresAttunement?: boolean;
  attuned?: boolean;
  /** V3.1-155 : la catégorie d'armure de l'objet (`Shield` pour un bouclier) — la CA sans armure en dépend. */
  armorCategory?: "Light" | "Medium" | "Heavy" | "Shield";
}

export interface ActiveEffect {
  key: string;
  label: string;
  modifiers: Modifier[];
  /** V3.1-158 : la règle qui a posé l'effet ; si le personnage la possède, ses formules lisent la table de sa classe (bonus de dégâts de la Rage). */
  ruleKey?: string;
}

// --- Fiche derivee (§B7) ----------------------------------------------------

export type RollState = "advantage" | "disadvantage" | "normal";

export interface AbilityResult {
  score: number;
  mod: number;
  sources: Source[];
}

export interface SavingThrowResult {
  mod: number;
  proficient: boolean;
  rollState: RollState;
  sources: Source[];
  /** V3.1-155 : dés de bonus (Bénédiction), lancés à chaque jet. */
  dice: BonusDie[];
}

/** V3.1-46 : un jet de caractéristique (Force, Dextérité…), hors compétence. */
export interface AbilityCheckResult {
  mod: number;
  /** La moitié de la maîtrise s'y ajoute (Touche-à-tout). */
  halfProficiency: boolean;
  rollState: RollState;
  sources: Source[];
  /** V3.1-155 : dés de bonus (Bénédiction), lancés à chaque jet. */
  dice: BonusDie[];
}

export interface SkillResult {
  mod: number;
  /** `half` : sans maîtrise, mais la moitié de la maîtrise s'ajoute (Touche-à-tout, V3.1-46). */
  proficiency: "none" | "half" | "proficient" | "expertise";
  rollState: RollState;
  sources: Source[];
  /** V3.1-155 : dés de bonus (Bénédiction), lancés à chaque jet. */
  dice: BonusDie[];
}

/**
 * V3.1-178 — les valeurs passives des règles 2024. Perception, Intuition,
 * Investigation : 10 + modificateur de la compétence, ±5 selon l'état du jet,
 * puis les bonus posés sur `passive.<compétence>`.
 */
export const PASSIVE_SKILLS = ["perception", "insight", "investigation"] as const;
export type PassiveSkill = (typeof PASSIVE_SKILLS)[number];
const PASSIVE_SKILL_LABELS: Record<PassiveSkill, string> = { perception: "Perception", insight: "Intuition", investigation: "Investigation" };

export interface PassiveResult {
  value: number;
  /** L'état du jet de la compétence (avantage : +5, désavantage : −5). */
  rollState: RollState;
  sources: Source[];
}

export interface DerivedSheet {
  abilities: Record<Ability, AbilityResult>;
  proficiencyBonus: number;
  ac: { value: number; sources: Source[] };
  savingThrows: Record<Ability, SavingThrowResult>;
  /** V3.1-46 : les six jets de caractéristique. */
  abilityChecks: Record<Ability, AbilityCheckResult>;
  skills: Record<Skill, SkillResult>;
  /** V3.1-178 : Perception, Intuition et Investigation passives. */
  passives: Record<PassiveSkill, PassiveResult>;
  hitPoints: { max: number; hitDice: string; sources: Source[] };
  speed: { value: number; sources: Source[] };
  features: ResolvedFeature[];
  spellcasting?: {
    ability: Ability;
    saveDc: number;
    attackBonus: number;
    slots: Record<number, number>;
    /** V3.1-113 : réserve de pacte, séparée des emplacements ordinaires. */
    pactSlots?: { count: number; slotLevel: number };
  };
  /** V3.1-116 : sorts accordés par les aptitudes, au niveau atteint. */
  grantedSpells: GrantedSpell[];
  /** V3.1-129 : ressources déclarées par les règles du personnage. Seuls les usages consommés vivent dans l'état de jeu. */
  resources: SheetResource[];
  warnings: Warning[];
  encumbrance: EncumbranceResult;
  /** V3.1-155 (ADR 0074) : sens (en mètres), présents seulement s'ils valent plus que 0. */
  senses: Partial<Record<Sense, { value: number; sources: Source[] }>>;
  /** V3.1-155 : vitesses spéciales (même unité que `speed`), présentes seulement si plus que 0. */
  speeds: Partial<Record<SpecialSpeed, { value: number; sources: Source[] }>>;
  /** V3.1-155 : maîtrises d'arme, d'armure ou d'outil accordées par une règle (`prof.weapon.martial`…). */
  grantedProficiencies: { target: string; label: string }[];
  /** V3.1-155 : les modificateurs résolus des cibles de jet (attaque, dégâts, critique), lus par `rollBonus`. */
  rollModifiers: Modifier[];
}

export const SENSES = ["darkvision", "blindsight", "tremorsense", "truesight"] as const;
export type Sense = (typeof SENSES)[number];
export const SPECIAL_SPEEDS = ["fly", "swim", "climb", "burrow"] as const;
export type SpecialSpeed = (typeof SPECIAL_SPEEDS)[number];

// --- Empilement generique (§B4 regles 1-5) ---------------------------------

const LAYER_ORDER: readonly Layer[] = [1, 2, 3, 4, 5, 6, 7];

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Empile les modificateurs numeriques d'une cible donnee (§B4). `set` efface
 * tout ce qui precede sur cette cible (regle 4) ; `min`/`max` sont des bornes
 * appliquees en dernier (regle 5), quelle que soit leur couche d'origine.
 */
function resolveTargetStack(
  target: string,
  modifiers: readonly Modifier[],
  base: number,
  baseLabel: string | null,
): { value: number; sources: Source[] } {
  // V3.1-155 : un modificateur fait seulement de dés n'a pas de nombre — ses dés vivent à part (`dice`).
  const relevant = modifiers.filter(
    (m) => m.target === target && m.value !== undefined && (m.op === "add" || m.op === "set" || m.op === "min" || m.op === "max"),
  );

  let value = base;
  let sources: Source[] = baseLabel === null ? [] : [{ label: baseLabel, value: base }];
  const mins: number[] = [];
  const maxes: number[] = [];

  for (const layer of LAYER_ORDER) {
    const inLayer = relevant.filter((m) => m.layer === layer);

    for (const m of inLayer) {
      if (m.op === "min") mins.push(m.value!);
      if (m.op === "max") maxes.push(m.value!);
    }

    const sets = inLayer.filter((m) => m.op === "set");
    if (sets.length > 0) {
      const winning = sets[sets.length - 1];
      value = winning.value!;
      sources = [{ label: winning.label, value: winning.value! }];
    }

    const adds = inLayer.filter((m) => m.op === "add");
    const stackAdds = adds.filter((m) => (m.stacking ?? "stack") === "stack");
    const highestAdds = adds.filter((m) => m.stacking === "highest");
    const uniqueAdds = adds.filter((m) => m.stacking === "unique");

    for (const m of stackAdds) {
      value += m.value!;
      sources.push({ label: m.label, value: m.value! });
    }
    if (highestAdds.length > 0) {
      const top = highestAdds.reduce((a, b) => (b.value! > a.value! ? b : a));
      value += top.value!;
      sources.push({ label: top.label, value: top.value! });
    }
    if (uniqueAdds.length > 0) {
      const first = uniqueAdds[0];
      value += first.value!;
      sources.push({ label: first.label, value: first.value! });
    }
  }

  if (mins.length > 0) value = Math.max(value, ...mins);
  if (maxes.length > 0) value = Math.min(value, ...maxes);

  return { value, sources };
}

/**
 * Une pile posée SUR une valeur déjà calculée (caractéristique + maîtrise) :
 * les bonus chiffrés d'une sauvegarde ou d'une compétence (`add`, `set`,
 * `min`, `max`), avec les mêmes règles que `resolveTargetStack`. Les sources
 * de départ restent en tête ; un `set` les remplace, comme partout ailleurs.
 */
function stackOnto(target: string, modifiers: readonly Modifier[], base: number, baseSources: readonly Source[]): { value: number; sources: Source[] } {
  const r = resolveTargetStack(target, modifiers, base, null);
  const fixe = modifiers.some((m) => m.target === target && m.op === "set");
  return { value: r.value, sources: fixe ? r.sources : [...baseSources, ...r.sources] };
}

/**
 * Etat d'un jet (§B4 regle 6) : avantage et desavantage ne s'empilent jamais
 * et s'annulent mutuellement des qu'ils coexistent sur la meme cible.
 */
/** Avantage et désavantage d'une ou plusieurs cibles (une compétence est aussi un jet de sa caractéristique). */
function resolveRollState(target: string | readonly string[], modifiers: readonly Modifier[]): RollState {
  const targets = typeof target === "string" ? [target] : target;
  const hasAdvantage = modifiers.some((m) => targets.includes(m.target) && m.op === "advantage");
  const hasDisadvantage = modifiers.some((m) => targets.includes(m.target) && m.op === "disadvantage");
  if (hasAdvantage && hasDisadvantage) return "normal";
  if (hasAdvantage) return "advantage";
  if (hasDisadvantage) return "disadvantage";
  return "normal";
}

function proficiencyBonusForLevel(totalLevel: number): number {
  return 2 + Math.floor((totalLevel - 1) / 4);
}

// --- Points de vie (multiclassage, §B3 ; jet de de, V2-G1) -----------------

export function averageHitDie(faces: number): number {
  return Math.floor(faces / 2) + 1;
}

/** V3.1-176 : `max` (le dé entier) s'ajoute à la moyenne et au jet. */
export const HP_GAIN_CHOICES = ["average", "rolled", "max"] as const;
export type HpGainChoice = (typeof HP_GAIN_CHOICES)[number];

/** Un seul gain de PV (V2-G1) : la moyenne 5e (arrondie au superieur), le dé entier (V3.1-176), ou un jet reel via le RNG injecte — jamais `Math.random()` (CLAUDE.md regle 6). Pure : le RNG vient toujours de l'appelant (le serveur pour une vraie montee de niveau). */
export function resolveHpGain(choice: HpGainChoice, dieFaces: number, rng: Rng): number {
  if (choice === "average") return averageHitDie(dieFaces);
  if (choice === "max") return dieFaces;
  return rollDice(1, dieFaces, rng).total;
}

function computeHitPoints(
  build: CharacterBuild,
  ruleset: ResolvedRuleset,
  conMod: number,
  extraModifiers: readonly Modifier[],
): { max: number; hitDice: string; sources: Source[] } {
  let diceTotal = 0;
  const hitDiceParts: string[] = [];
  let totalLevel = 0;

  build.classes.forEach((cl, index) => {
    const klass = ruleset.classes[cl.key];
    if (!klass) return;
    totalLevel += cl.level;
    hitDiceParts.push(`${cl.level}d${klass.hitDie}`);

    // Seul le tout premier niveau du personnage (premiere classe, niveau 1)
    // prend le maximum du de de vie ; tous les autres niveaux — y compris
    // les suivants de la meme classe — prennent soit une valeur JETEE et
    // enregistree (`hpRolls`, V2-G1), soit a defaut la moyenne (§B3,
    // comportement inchange pour un personnage sans historique de jets).
    const levelsAtAverage = index === 0 ? cl.level - 1 : cl.level;
    if (index === 0) diceTotal += klass.hitDie;
    const rolls = cl.hpRolls ?? [];
    const recordedCount = Math.min(rolls.length, levelsAtAverage);
    for (let i = 0; i < recordedCount; i++) diceTotal += rolls[i];
    diceTotal += (levelsAtAverage - recordedCount) * averageHitDie(klass.hitDie);
  });

  const conTotal = conMod * totalLevel;
  const base = diceTotal + conTotal;
  const sources: Source[] = [
    { label: `Des de vie (${hitDiceParts.join(" + ")})`, value: diceTotal },
    { label: "Constitution", value: conTotal },
  ];

  const extra = resolveTargetStack("hp.max", extraModifiers, 0, null);
  const max = base + extra.value;

  return { max, hitDice: hitDiceParts.join(" + "), sources: [...sources, ...extra.sources] };
}

// --- Prerequis (§B5) --------------------------------------------------------

function describePrerequisite(p: Prerequisite): string {
  if (p.kind === "ability" && p.ability && p.min !== undefined) {
    return `${ABILITY_LABELS[p.ability]} >= ${p.min}`;
  }
  if (p.kind === "level" && p.min !== undefined) {
    return `Niveau >= ${p.min}`;
  }
  if (p.kind === "has_feature" && p.key) {
    return `Possede "${p.key}"`;
  }
  return "prerequis inconnu";
}

function checkPrerequisites(
  feature: ResolvedFeature,
  abilities: Record<Ability, AbilityResult>,
  totalLevel: number,
  grantedFeatureKeys: ReadonlySet<string>,
): Warning[] {
  const warnings: Warning[] = [];
  for (const p of feature.prerequisites ?? []) {
    let met = true;
    if (p.kind === "ability" && p.ability && p.min !== undefined) {
      met = abilities[p.ability].score >= p.min;
    } else if (p.kind === "level" && p.min !== undefined) {
      met = totalLevel >= p.min;
    } else if (p.kind === "has_feature" && p.key) {
      met = grantedFeatureKeys.has(p.key);
    }
    if (!met) {
      warnings.push({
        kind: "unmet_prerequisite",
        featureKey: feature.key,
        message: `Prerequis non satisfait pour "${feature.label}" : ${describePrerequisite(p)}`,
      });
    }
  }
  return warnings;
}

// --- Fonction principale ----------------------------------------------------

/** V3.1-121 : un modificateur « par niveau » prend sa valeur finale ici, une seule fois, avant toute pile. Les sources affichent donc le total (« Ténacité naine 4 » au niveau 4). */
function scaleByLevel(m: Modifier, totalLevel: number): Modifier {
  return m.perLevel && m.value !== undefined ? { ...m, value: m.value * totalLevel } : m;
}

type Refs = Record<string, number>;

/** V3.1-155 (ADR 0074) : `…{choice:<clé>}` prend la réponse du personnage ; sans réponse, la cible ne vise rien. */
function resolveChoiceTarget(target: string, choices: CharacterBuild["choices"]): string | null {
  const m = /\{choice:([^}]+)\}/.exec(target);
  if (!m) return target;
  // Une réponse est une clé, ou une liste de clés (même lecture que `asKeyList`, choices.ts) : la première compte.
  const brut = choices?.[m[1]];
  const v = Array.isArray(brut) ? brut.find((x): x is string => typeof x === "string") : brut;
  return typeof v === "string" && v !== "" ? target.replace(m[0], v.toLowerCase()) : null;
}

function evalSide(side: number | FormulaNode, refs: Refs): number {
  return typeof side === "number" ? side : Math.floor(evaluate(side, refs, SANS_DE, "average").value);
}

/**
 * V3.1-155 (ADR 0074) — la valeur d'un modificateur en formule, résolue :
 * le nombre dans `value`, les dés de bonus dans `dice` (« 1d4 + 1 » → 1 et
 * 1d4). Une formule incalculable compte 0 et lève un avertissement.
 */
function materializeModifier(m: Modifier, refs: Refs, warnings: Warning[]): Modifier {
  if (!m.formula) return m;
  const { formula, ...rest } = m;
  let value = 0;
  let hasNumber = false;
  const dice: BonusDie[] = [];
  try {
    for (const term of additiveTerms(formula)) {
      if (!containsDice(term)) {
        value += evaluate(term, refs, SANS_DE, "average").value;
        hasNumber = true;
        continue;
      }
      if (term.op !== "dice") throw new Error("un dé de bonus s'écrit seul, ou ajouté à un nombre (« 1d4 + 1 »)");
      const count = evalSide(term.count, refs);
      const faces = evalSide(term.faces, refs);
      if (faces < 1 || count < 0) throw new Error(`dé invalide (${count}d${faces})`);
      if (count > 0) dice.push({ count, faces, label: m.label, source: m.source });
    }
  } catch (err) {
    warnings.push({ kind: "modifier_formula", source: m.source, message: `${m.label} : ${err instanceof Error ? err.message : String(err)}` });
    return { ...rest, value: 0 };
  }
  return { ...rest, ...(hasNumber || dice.length === 0 ? { value: Math.floor(value) } : {}), ...(dice.length > 0 ? { dice } : {}) };
}

/** Les dés de bonus d'un jet : une règle `unique` ne compte qu'une fois par source. */
function collectDice(targets: readonly string[], modifiers: readonly Modifier[]): BonusDie[] {
  const out: BonusDie[] = [];
  const vus = new Set<string>();
  for (const m of modifiers) {
    if (!targets.includes(m.target) || m.op !== "add" || !m.dice) continue;
    if (m.stacking === "unique" || m.stacking === "highest") {
      if (vus.has(m.source)) continue;
      vus.add(m.source);
    }
    out.push(...m.dice);
  }
  return out;
}

export type RollQuery =
  | { roll: "attack"; kind: "weapon" | "spell" }
  | { roll: "damage"; kind: "weapon" | "spell"; ability?: Ability; damageType?: string };

export interface RollBonusResult {
  value: number;
  dice: BonusDie[];
  sources: Source[];
  rollState: RollState;
  /** Le plus petit d20 naturel qui fait un critique (20 par défaut, 19 pour le Critique amélioré). */
  critRange: number;
}

/**
 * V3.1-155 (ADR 0074) — ce qu'un jet d'attaque ou de dégâts reçoit des
 * règles du personnage : bonus chiffré, dés de bonus, avantage, plage de
 * critique. `damage.<genre>.<car>` vise une attaque faite avec cette
 * caractéristique (la Rage) ; `damage.<genre>.<type>`, un type de dégâts.
 */
export function rollBonus(sheet: Pick<DerivedSheet, "rollModifiers">, q: RollQuery): RollBonusResult {
  const targets =
    q.roll === "attack"
      ? ["attack", `attack.${q.kind}`]
      : ["damage", `damage.${q.kind}`, ...(q.ability ? [`damage.${q.kind}.${q.ability}`] : []), ...(q.damageType ? [`damage.${q.kind}.${q.damageType.toLowerCase()}`] : [])];
  const matched = sheet.rollModifiers.filter((m) => targets.includes(m.target)).map((m) => ({ ...m, target: "roll" }));
  const { value, sources } = resolveTargetStack("roll", matched, 0, null);
  const crits =
    q.roll === "attack"
      ? sheet.rollModifiers.filter((m) => (m.target === "crit_range" || m.target === `crit_range.${q.kind}`) && m.op === "set" && m.value !== undefined).map((m) => m.value!)
      : [];
  return {
    value,
    dice: collectDice(["roll"], matched),
    sources,
    rollState: q.roll === "attack" ? resolveRollState("roll", matched) : "normal",
    critRange: Math.min(20, ...crits),
  };
}

export function characterSheet(
  build: CharacterBuild,
  ruleset: ResolvedRuleset,
  equipment: EquippedItem[],
  activeEffects: ActiveEffect[],
  /** Poids total porte (§ encombrement) — 0 par defaut, aucun appelant existant n'est affecte. */
  carriedWeight = 0,
): DerivedSheet {
  const totalLevel = build.classes.reduce((sum, c) => sum + c.level, 0);
  const proficiencyBonus = proficiencyBonusForLevel(totalLevel);

  const features = build.featureKeys.map((k) => ruleset.features[k]).filter((f): f is ResolvedFeature => f != null);

  // Regle de multiclassage : seule la premiere classe accorde des maitrises
  // de sauvegarde (§B4 layer 3).
  const firstClass = build.classes[0] ? ruleset.classes[build.classes[0].key] : undefined;
  const savingThrowProficiencyMods: Modifier[] = (firstClass?.savingThrowProficiencies ?? []).map((ability) => ({
    target: `save.${ability}`,
    op: "proficiency",
    source: `class:${firstClass!.key}`,
    label: firstClass!.label,
    layer: 3,
  }));

  // V3.1-155 (ADR 0074) : chaque modificateur garde la provenance de sa règle
  // (`class:<clé>`) pour ses formules : `class.level` et `column.*` en dépendent.
  type Brut = { m: Modifier; origin?: string };
  const bruts: Brut[] = [
    ...features.flatMap((f) => f.modifiers.map((m): Brut => ({ m, origin: f.source }))),
    ...savingThrowProficiencyMods.map((m): Brut => ({ m })),
    ...equipment.filter((e) => e.equipped).flatMap((e) => e.modifiers.map((m): Brut => ({ m }))),
    ...activeEffects.flatMap((e) => {
      const origin = e.ruleKey ? features.find((f) => f.key === e.ruleKey)?.source : undefined;
      return e.modifiers.map((m): Brut => (origin ? { m, origin } : { m }));
    }),
  ].flatMap((b) => {
    const target = resolveChoiceTarget(b.m.target, build.choices);
    return target === null ? [] : [target === b.m.target ? b : { ...b, m: { ...b.m, target } }];
  });
  const formulaWarnings: Warning[] = [];
  const refsFor = (origin: string | undefined, extra: Refs): Refs => {
    const classLevel = grantingClassLevel(origin ?? "", build.classes);
    const refs: Refs = { level: totalLevel, proficiency: proficiencyBonus, "class.level": classLevel, ...extra };
    if (origin?.startsWith("class:")) {
      for (const [k, v] of Object.entries(progressionAt(ruleset.classes[origin.slice("class:".length)]?.progression, classLevel))) refs[`column.${k}`] = v;
    }
    return refs;
  };
  const materialize = (liste: readonly Brut[], extra: Refs): Modifier[] =>
    liste.map((b) => scaleByLevel(materializeModifier(b.m, refsFor(b.origin, extra), formulaWarnings), totalLevel));
  // Temps 1 : les caractéristiques — leurs formules ne lisent pas les caractéristiques.
  const pourCaracteristiques = (b: Brut) => b.m.target.startsWith("ability.");
  const pourVitessesSpeciales = (b: Brut) => b.m.target.startsWith("speed.");
  const allModifiers: Modifier[] = materialize(bruts.filter(pourCaracteristiques), {});

  // Couche 1 : caracteristiques attribuees, plus couches 2/5 (espece, ASI/dons).
  const abilities = {} as Record<Ability, AbilityResult>;
  for (const ability of ABILITIES) {
    const { value, sources } = resolveTargetStack(
      `ability.${ability}`,
      allModifiers,
      build.abilities.assigned[ability],
      "Valeur attribuée",
    );
    // V3.1-115 : le plafond du ruleset, sauf si un objet FIXE la valeur (« Force 19 »), qui peut le dépasser.
    const cap = ruleset.characterRules?.ability_score_cap;
    const fixedByItem = allModifiers.some((m) => m.target === `ability.${ability}` && m.op === "set");
    const score = cap !== undefined && !fixedByItem ? Math.min(value, cap) : value;
    abilities[ability] = { score, mod: abilityModifier(score), sources };
  }

  // Temps 2 : le reste, qui lit les caractéristiques (et le DD des sorts de la première classe incantatrice).
  const abilityRefs: Refs = {};
  for (const a of ABILITIES) abilityRefs[`ability.${a}`] = abilities[a].mod;
  const casterAbility = build.classes.map((cl) => ruleset.classes[cl.key]).find((k) => k?.spellcasting)?.spellcasting?.ability;
  if (casterAbility) abilityRefs.spell_save_dc = spellNumbers(abilities[casterAbility].mod, proficiencyBonus).saveDc;
  allModifiers.push(...materialize(bruts.filter((b) => !pourCaracteristiques(b) && !pourVitessesSpeciales(b)), abilityRefs));

  // Encombrement (couche 6) : depend du score de Force resolu ci-dessus,
  // ajoute donc ses propres modificateurs (vitesse, desavantage) apres coup
  // plutot que d'etre precalcule avec le reste — n'affecte jamais ability.*,
  // ac, ni hp.max, seulement savingThrows/skills/speed ci-dessous.
  const encumbrance: EncumbranceResult = ruleset.characterRules
    ? computeEncumbrance(abilities.str.score, carriedWeight, ruleset.characterRules.encumbrance)
    : { carried: carriedWeight, capacity: 0, tier: "none", speedPenalty: 0, disadvantageAbilities: [] };
  allModifiers.push(...encumbranceModifiers(encumbrance, "encumbrance", "Encombrement"));

  // Classe d'armure : base 10 + Dex, ecrasee par un "set" d'armure lourde le cas echeant.
  // V3.1-155 (ADR 0074) : sans armure, une CA « sans armure » (Barbare, Moine)
  // peut remplacer la base ; la meilleure l'emporte (une seule base à la fois).
  const porteArmure = equipment.some((e) => e.equipped && e.armorCategory !== undefined && e.armorCategory !== "Shield");
  const porteBouclier = equipment.some((e) => e.equipped && e.armorCategory === "Shield");
  let acBase = 10 + abilities.dex.mod;
  let acLabel = "Base (10 + Dex)";
  if (!porteArmure) {
    for (const m of allModifiers) {
      const vise = m.target === "ac.unarmored" || (m.target === "ac.unarmored_no_shield" && !porteBouclier);
      if (vise && m.op === "set" && m.value !== undefined && m.value > acBase) {
        acBase = m.value;
        acLabel = m.label;
      }
    }
  }
  const ac = resolveTargetStack("ac", allModifiers, acBase, acLabel);

  const savingThrows = {} as Record<Ability, SavingThrowResult>;
  for (const ability of ABILITIES) {
    const target = `save.${ability}`;
    // V3.1-155 : `save` vise les six sauvegardes (Aura de protection, Bénédiction).
    const saveMods = allModifiers.map((m) => (m.target === "save" ? { ...m, target } : m));
    const proficient = saveMods.some((m) => m.target === target && m.op === "proficiency");
    const base = abilities[ability].mod + (proficient ? proficiencyBonus : 0);
    const baseSources: Source[] = [{ label: ABILITY_LABELS[ability], value: abilities[ability].mod }];
    if (proficient) baseSources.push({ label: "Maitrise", value: proficiencyBonus });
    // Les bonus chiffrés (« +1 aux sauvegardes ») passent par la même pile que la CA.
    const { value: mod, sources } = stackOnto(target, saveMods, base, baseSources);
    savingThrows[ability] = { mod, proficient, rollState: resolveRollState(target, saveMods), sources, dice: collectDice([target], saveMods) };
  }

  // V3.1-46 : la moitié de la maîtrise (Touche-à-tout) sur les jets de caractéristique sans maîtrise.
  const halfProficiency = Math.floor(proficiencyBonus / 2);
  const halfProficiencyApplies = (ability: Ability) =>
    allModifiers.some((m) => m.op === "half_proficiency" && (m.target === "check" || m.target === `check.${ability}`));
  const halfProficiencyLabel = (ability: Ability) =>
    allModifiers.find((m) => m.op === "half_proficiency" && (m.target === "check" || m.target === `check.${ability}`))?.label ?? "Moitie de la maitrise";

  const abilityChecks = {} as Record<Ability, AbilityCheckResult>;
  for (const ability of ABILITIES) {
    const half = halfProficiencyApplies(ability);
    const sources: Source[] = [{ label: ABILITY_LABELS[ability], value: abilities[ability].mod }];
    if (half) sources.push({ label: halfProficiencyLabel(ability), value: halfProficiency });
    abilityChecks[ability] = {
      mod: abilities[ability].mod + (half ? halfProficiency : 0),
      halfProficiency: half,
      rollState: resolveRollState(`check.${ability}`, allModifiers),
      sources,
      dice: collectDice([`check.${ability}`, "check"], allModifiers),
    };
  }

  const skills = {} as Record<Skill, SkillResult>;
  for (const skill of SKILLS) {
    const target = `skill.${skill}`;
    const governing = SKILL_ABILITIES[skill];
    const expertise = allModifiers.some((m) => m.target === target && m.op === "expertise");
    const proficient = expertise || allModifiers.some((m) => m.target === target && m.op === "proficiency");
    const half = !proficient && halfProficiencyApplies(governing);
    const multiplier = expertise ? 2 : 1;
    const base = abilities[governing].mod + (proficient ? proficiencyBonus * multiplier : half ? halfProficiency : 0);
    const baseSources: Source[] = [{ label: ABILITY_LABELS[governing], value: abilities[governing].mod }];
    if (proficient) baseSources.push({ label: expertise ? "Expertise" : "Maitrise", value: proficiencyBonus * multiplier });
    if (half) baseSources.push({ label: halfProficiencyLabel(governing), value: halfProficiency });
    const { value: mod, sources } = stackOnto(target, allModifiers, base, baseSources);
    skills[skill] = {
      mod,
      proficiency: expertise ? "expertise" : proficient ? "proficient" : half ? "half" : "none",
      // Une compétence est un jet de sa caractéristique : un avantage sur la Force vaut pour l'Athlétisme.
      rollState: resolveRollState([target, `check.${governing}`], allModifiers),
      sources,
      dice: collectDice([target, `check.${governing}`, "check"], allModifiers),
    };
  }

  // V3.1-178 : chaque valeur passive part du jet actif de sa compétence
  // (maîtrise, expertise, bonus compris), puis l'avantage vaut +5, le
  // désavantage −5, et une règle peut viser la valeur passive seule.
  const passives = {} as Record<PassiveSkill, PassiveResult>;
  for (const skill of PASSIVE_SKILLS) {
    const actif = skills[skill];
    const rollState = resolveRollState([`passive.${skill}`, `skill.${skill}`, `check.${SKILL_ABILITIES[skill]}`], allModifiers);
    const ajustement = rollState === "advantage" ? 5 : rollState === "disadvantage" ? -5 : 0;
    const baseSources: Source[] = [
      { label: "Base", value: 10 },
      { label: PASSIVE_SKILL_LABELS[skill], value: actif.mod },
    ];
    if (ajustement !== 0) baseSources.push({ label: ajustement > 0 ? "Avantage" : "Désavantage", value: ajustement });
    const { value, sources } = stackOnto(`passive.${skill}`, allModifiers, 10 + actif.mod + ajustement, baseSources);
    passives[skill] = { value, rollState, sources };
  }

  const hitPoints = computeHitPoints(build, ruleset, abilities.con.mod, allModifiers);
  const speed = resolveTargetStack("speed", allModifiers, 30, "Vitesse de base");

  // Temps 3 : les vitesses spéciales, qui peuvent lire la vitesse au sol (« vitesse de vol égale à votre vitesse »).
  allModifiers.push(...materialize(bruts.filter(pourVitessesSpeciales), { ...abilityRefs, speed: speed.value }));
  const speeds: DerivedSheet["speeds"] = {};
  for (const sp of SPECIAL_SPEEDS) {
    if (!allModifiers.some((m) => m.target === `speed.${sp}`)) continue;
    const r = resolveTargetStack(`speed.${sp}`, allModifiers, 0, null);
    if (r.value > 0) speeds[sp] = r;
  }
  const senses: DerivedSheet["senses"] = {};
  for (const se of SENSES) {
    if (!allModifiers.some((m) => m.target === `sense.${se}`)) continue;
    const r = resolveTargetStack(`sense.${se}`, allModifiers, 0, null);
    if (r.value > 0) senses[se] = r;
  }
  const grantedProficiencies: DerivedSheet["grantedProficiencies"] = [];
  for (const m of allModifiers) {
    if (m.op === "proficiency" && m.target.startsWith("prof.") && !grantedProficiencies.some((g) => g.target === m.target)) {
      grantedProficiencies.push({ target: m.target, label: m.label });
    }
  }
  const rollModifiers = allModifiers.filter((m) => /^(attack|damage|crit_range)(\.|$)/.test(m.target));

  const grantedFeatureKeys = new Set(build.featureKeys);
  const warnings: Warning[] = [...features.flatMap((f) => checkPrerequisites(f, abilities, totalLevel, grantedFeatureKeys)), ...formulaWarnings];
  if (!ruleset.characterRules) {
    warnings.push({ kind: "missing_character_rules", message: "Ce ruleset n'a pas de règles de personnage : plafond de caractéristique et charge ne sont pas appliqués." });
  }

  // V3.1-113 : emplacements de toutes les classes (multiclassé, pacte à part).
  // La caractéristique reste celle de la première classe incantatrice.
  let spellcasting: DerivedSheet["spellcasting"];
  const firstCaster = build.classes.map((cl) => ruleset.classes[cl.key]).find((k) => k?.spellcasting);
  if (firstCaster?.spellcasting) {
    const ability = firstCaster.spellcasting.ability;
    const computed = computeSpellSlots(
      build.classes.map((cl) => ({ key: cl.key, level: cl.level, spellcasting: ruleset.classes[cl.key]?.spellcasting })),
      ruleset.characterRules?.multiclass_spell_slots
    );
    if (computed.missingMulticlassTable) {
      warnings.push({ kind: "missing_multiclass_table", message: "Plusieurs classes lancent des sorts, mais ce ruleset n'a pas de table du multiclassé : emplacements non calculés." });
    }
    spellcasting = {
      ability,
      ...spellNumbers(abilities[ability].mod, proficiencyBonus),
      slots: computed.slots,
      ...(computed.pact ? { pactSlots: computed.pact } : {}),
    };
  }

  const grantedSpells: GrantedSpell[] = features.flatMap((f) =>
    (f.spells ?? [])
      .filter((s) => s.atLevel <= (s.classKey ? (build.classes.find((c) => c.key === s.classKey)?.level ?? 0) : totalLevel))
      .map((s) => ({
        key: s.key,
        featureKey: f.key,
        label: f.label,
        alwaysPrepared: s.alwaysPrepared,
        ...(s.freeCast ? { freeCast: s.freeCast } : {}),
        ...(s.ability
          ? { ability: s.ability, ...spellNumbers(abilities[s.ability].mod, proficiencyBonus) }
          : {}),
      }))
  );

  const resources = computeResources({ build, ruleset, features, equipment, abilities, proficiencyBonus, totalLevel, spellSaveDc: spellcasting?.saveDc, warnings });

  return {
    abilities, proficiencyBonus, ac, savingThrows, abilityChecks, skills, passives, hitPoints, speed, features, spellcasting, grantedSpells, resources, warnings, encumbrance,
    senses, speeds, grantedProficiencies, rollModifiers,
  };
}

/** Un maximum ne lance jamais de dé : un `dice` dans la formule est une faute de donnée, signalée comme une référence inconnue. */
const SANS_DE: Rng = {
  nextInt() {
    throw new Error("un maximum de ressource ne lance pas de dé");
  },
};

/** La dernière ligne de progression atteinte au niveau `level` (colonnes `column.<clé>`). */
function progressionAt(progression: ResolvedClass["progression"], level: number): Record<string, number> {
  if (!progression) return {};
  const niveaux = Object.keys(progression)
    .map(Number)
    .filter((n) => n <= level)
    .sort((a, b) => a - b);
  const out: Record<string, number> = {};
  for (const n of niveaux) Object.assign(out, progression[n]);
  return out;
}

/**
 * V3.1-129 (ADR 0060 §1) — les ressources déclarées, calculées depuis les
 * fiches du personnage et ses objets équipés (liés s'ils le demandent).
 * Références : `level` (personnage), `class.level` et `column.<clé>` (classe
 * qui accorde la fiche, lue dans le préfixe `class:` de sa source),
 * `proficiency`, `ability.<car>` (modificateur), `spell_save_dc`. Deux fiches
 * qui déclarent la même clé : une seule ligne, le plus grand maximum.
 */
/**
 * V3.1-133 — le niveau « de la classe » d'une règle (`class.level` dans ses
 * formules) : le niveau dans la classe qui l'accorde (`source` « class:<clé> »),
 * sinon le niveau total. Partagé par les maximums de ressources et par
 * l'activation (« 1d10 + votre niveau de Guerrier »).
 */
export function grantingClassLevel(source: string, classes: readonly { key: string; level: number }[]): number {
  const total = classes.reduce((s, c) => s + c.level, 0);
  if (!source.startsWith("class:")) return total;
  const cle = source.slice("class:".length);
  return classes.find((c) => c.key === cle)?.level ?? 0;
}

function computeResources(p: {
  build: CharacterBuild;
  ruleset: ResolvedRuleset;
  features: readonly ResolvedFeature[];
  equipment: readonly EquippedItem[];
  abilities: Record<Ability, AbilityResult>;
  proficiencyBonus: number;
  totalLevel: number;
  spellSaveDc: number | undefined;
  warnings: Warning[];
}): SheetResource[] {
  const base: Record<string, number> = { level: p.totalLevel, proficiency: p.proficiencyBonus };
  for (const a of ABILITIES) base[`ability.${a}`] = p.abilities[a].mod;
  if (p.spellSaveDc !== undefined) base.spell_save_dc = p.spellSaveDc;

  const sources: { key: string; classKey: string | null; resources: readonly RuleResource[] }[] = [
    ...p.features.map((f) => ({ key: f.key, classKey: f.source.startsWith("class:") ? f.source.slice("class:".length) : null, resources: f.resources ?? [] })),
    ...p.equipment
      .filter((e) => e.equipped && (!e.requiresAttunement || e.attuned === true))
      .map((e) => ({ key: e.key, classKey: null, resources: e.resources ?? [] })),
  ];

  const byKey = new Map<string, SheetResource>();
  for (const src of sources) {
    if (src.resources.length === 0) continue;
    const classLevel = src.classKey ? grantingClassLevel(`class:${src.classKey}`, p.build.classes) : p.totalLevel;
    const refs: Record<string, number> = { ...base, "class.level": classLevel };
    if (src.classKey) {
      for (const [k, v] of Object.entries(progressionAt(p.ruleset.classes[src.classKey]?.progression, classLevel))) refs[`column.${k}`] = v;
    }
    for (const r of src.resources) {
      let max: number;
      try {
        max = Math.max(0, Math.floor(evaluate(r.max, refs, SANS_DE, "average").value));
      } catch (err) {
        max = 0;
        p.warnings.push({
          kind: "resource_formula",
          featureKey: src.key,
          message: `Maximum de « ${r.key} » incalculable : ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      const existing = byKey.get(r.key);
      if (!existing || max > existing.max) byKey.set(r.key, { key: r.key, label: r.label, max, recharge: r.recharge, ...(r.regain ? { regain: r.regain } : {}), source: src.key });
    }
  }
  return [...byKey.values()];
}
