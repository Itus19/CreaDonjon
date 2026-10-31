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
}

export interface Source {
  label: string;
  value: number;
}

/** Un modificateur tel qu'une fiche de regle generique le declare (bloc `modifiers`, specs/regles-blocs.md) — cible/effet/valeur seulement, jamais source/etiquette/couche : ces trois-la dependent d'OU la fiche est accrochee sur un personnage, jamais de la fiche elle-meme. */
export interface DeclaredModifier {
  target: string;
  op: ModifierOp;
  value?: number;
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
  return declared.map((d) => ({ target: d.target, op: d.op, value: d.value, source, label, layer, ...(d.per_level ? { perLevel: true } : {}) }));
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
  | { kind: "missing_character_rules"; message: string };

// --- Ruleset resolu et build (§B1-B3) --------------------------------------

export interface ClassSpellcasting {
  ability: Ability;
  /** V3.1-113 (ADR 0045) : `pact` — magie de pacte, réserve séparée d'un seul niveau. Absent : emplacements ordinaires. */
  kind?: "slots" | "pact";
  /** V3.1-113 : poids dans le calcul du multiclassé. Absent : la classe ne compte pas (occultiste, non-lanceur). */
  casterWeight?: { fraction: "full" | "half"; rounding: "up" | "down" };
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
}

export interface ActiveEffect {
  key: string;
  label: string;
  modifiers: Modifier[];
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
}

/** V3.1-46 : un jet de caractéristique (Force, Dextérité…), hors compétence. */
export interface AbilityCheckResult {
  mod: number;
  /** La moitié de la maîtrise s'y ajoute (Touche-à-tout). */
  halfProficiency: boolean;
  rollState: RollState;
  sources: Source[];
}

export interface SkillResult {
  mod: number;
  /** `half` : sans maîtrise, mais la moitié de la maîtrise s'ajoute (Touche-à-tout, V3.1-46). */
  proficiency: "none" | "half" | "proficient" | "expertise";
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
  warnings: Warning[];
  encumbrance: EncumbranceResult;
}

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
  const relevant = modifiers.filter(
    (m) => m.target === target && (m.op === "add" || m.op === "set" || m.op === "min" || m.op === "max"),
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

export type HpGainChoice = "average" | "rolled";

/** Un seul gain de PV (V2-G1) : la moyenne 5e (arrondie au superieur), ou un jet reel via le RNG injecte — jamais `Math.random()` (CLAUDE.md regle 6). Pure : le RNG vient toujours de l'appelant (le serveur pour une vraie montee de niveau). */
export function resolveHpGain(choice: HpGainChoice, dieFaces: number, rng: Rng): number {
  return choice === "average" ? averageHitDie(dieFaces) : rollDice(1, dieFaces, rng).total;
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

  const allModifiers: Modifier[] = [
    ...features.flatMap((f) => f.modifiers),
    ...savingThrowProficiencyMods,
    ...equipment.filter((e) => e.equipped).flatMap((e) => e.modifiers),
    ...activeEffects.flatMap((e) => e.modifiers),
  ].map((m) => scaleByLevel(m, totalLevel));

  // Couche 1 : caracteristiques attribuees, plus couches 2/5 (espece, ASI/dons).
  const abilities = {} as Record<Ability, AbilityResult>;
  for (const ability of ABILITIES) {
    const { value, sources } = resolveTargetStack(
      `ability.${ability}`,
      allModifiers,
      build.abilities.assigned[ability],
      "Valeur attribuee",
    );
    // V3.1-115 : le plafond du ruleset, sauf si un objet FIXE la valeur (« Force 19 »), qui peut le dépasser.
    const cap = ruleset.characterRules?.ability_score_cap;
    const fixedByItem = allModifiers.some((m) => m.target === `ability.${ability}` && m.op === "set");
    const score = cap !== undefined && !fixedByItem ? Math.min(value, cap) : value;
    abilities[ability] = { score, mod: abilityModifier(score), sources };
  }

  // Encombrement (couche 6) : depend du score de Force resolu ci-dessus,
  // ajoute donc ses propres modificateurs (vitesse, desavantage) apres coup
  // plutot que d'etre precalcule avec le reste — n'affecte jamais ability.*,
  // ac, ni hp.max, seulement savingThrows/skills/speed ci-dessous.
  const encumbrance: EncumbranceResult = ruleset.characterRules
    ? computeEncumbrance(abilities.str.score, carriedWeight, ruleset.characterRules.encumbrance)
    : { carried: carriedWeight, capacity: 0, tier: "none", speedPenalty: 0, disadvantageAbilities: [] };
  allModifiers.push(...encumbranceModifiers(encumbrance, "encumbrance", "Encombrement"));

  // Classe d'armure : base 10 + Dex, ecrasee par un "set" d'armure lourde le cas echeant.
  const acBase = 10 + abilities.dex.mod;
  const ac = resolveTargetStack("ac", allModifiers, acBase, "Base (10 + Dex)");

  const savingThrows = {} as Record<Ability, SavingThrowResult>;
  for (const ability of ABILITIES) {
    const target = `save.${ability}`;
    const proficient = allModifiers.some((m) => m.target === target && m.op === "proficiency");
    const mod = abilities[ability].mod + (proficient ? proficiencyBonus : 0);
    const sources: Source[] = [{ label: ABILITY_LABELS[ability], value: abilities[ability].mod }];
    if (proficient) sources.push({ label: "Maitrise", value: proficiencyBonus });
    savingThrows[ability] = { mod, proficient, rollState: resolveRollState(target, allModifiers), sources };
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
    const mod = abilities[governing].mod + (proficient ? proficiencyBonus * multiplier : half ? halfProficiency : 0);
    const sources: Source[] = [{ label: ABILITY_LABELS[governing], value: abilities[governing].mod }];
    if (proficient) sources.push({ label: expertise ? "Expertise" : "Maitrise", value: proficiencyBonus * multiplier });
    if (half) sources.push({ label: halfProficiencyLabel(governing), value: halfProficiency });
    skills[skill] = {
      mod,
      proficiency: expertise ? "expertise" : proficient ? "proficient" : half ? "half" : "none",
      // Une compétence est un jet de sa caractéristique : un avantage sur la Force vaut pour l'Athlétisme.
      rollState: resolveRollState([target, `check.${governing}`], allModifiers),
      sources,
    };
  }

  const hitPoints = computeHitPoints(build, ruleset, abilities.con.mod, allModifiers);
  const speed = resolveTargetStack("speed", allModifiers, 30, "Vitesse de base");

  const grantedFeatureKeys = new Set(build.featureKeys);
  const warnings: Warning[] = features.flatMap((f) => checkPrerequisites(f, abilities, totalLevel, grantedFeatureKeys));
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

  return { abilities, proficiencyBonus, ac, savingThrows, abilityChecks, skills, hitPoints, speed, features, spellcasting, grantedSpells, warnings, encumbrance };
}
