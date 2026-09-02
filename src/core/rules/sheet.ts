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
import { rollDice } from "../dice/roll";
import type { Rng } from "../dice/rng";

// --- Vocabulaire de base -------------------------------------------------

export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: readonly Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/** V2-M11 (Lot M) : exporte pour construire les libelles de jet ("Test de Force", "Sauvegarde de Sagesse") sans dupliquer cette table ailleurs — meme convention que les `sources` ci-dessous, qui l'utilisent deja. */
export const ABILITY_LABELS: Record<Ability, string> = {
  str: "Force",
  dex: "Dexterite",
  con: "Constitution",
  int: "Intelligence",
  wis: "Sagesse",
  cha: "Charisme",
};

export const SKILL_ABILITIES = {
  acrobatics: "dex",
  animal_handling: "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  sleight_of_hand: "dex",
  stealth: "dex",
  survival: "wis",
} as const satisfies Record<string, Ability>;
export type Skill = keyof typeof SKILL_ABILITIES;
export const SKILLS = Object.keys(SKILL_ABILITIES) as readonly Skill[];

// --- Modificateurs et empilement (§B4) -----------------------------------

export type ModifierOp =
  | "add"
  | "set"
  | "min"
  | "max"
  | "advantage"
  | "disadvantage"
  | "proficiency"
  | "expertise";

export type StackingRule = "stack" | "highest" | "unique";
export type Layer = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Modifier {
  target: string;
  op: ModifierOp;
  /** Absent pour advantage/disadvantage/proficiency/expertise — ce sont des drapeaux, pas des montants. */
  value?: number;
  /** Identifiant de provenance stable, ex. "item:ent_4c8a". Sert au regroupement "unique". */
  source: string;
  label: string;
  layer: Layer;
  /** Defaut "stack" si absent. */
  stacking?: StackingRule;
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
  return declared.map((d) => ({ target: d.target, op: d.op, value: d.value, source, label, layer }));
}

// --- Prerequis (§B5) ------------------------------------------------------

export interface Prerequisite {
  kind: "ability" | "has_feature" | "level";
  ability?: Ability;
  min?: number;
  key?: string;
}

export interface ResolvedFeature {
  key: string;
  label: string;
  source: string;
  modifiers: Modifier[];
  prerequisites?: Prerequisite[];
}

export interface Warning {
  kind: "unmet_prerequisite";
  message: string;
  featureKey: string;
}

// --- Ruleset resolu et build (§B1-B3) --------------------------------------

export interface ClassSpellcasting {
  ability: Ability;
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
}

export interface ResolvedRuleset {
  classes: Record<string, ResolvedClass>;
  features: Record<string, ResolvedFeature>;
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

export interface SkillResult {
  mod: number;
  proficiency: "none" | "proficient" | "expertise";
  rollState: RollState;
  sources: Source[];
}

export interface DerivedSheet {
  abilities: Record<Ability, AbilityResult>;
  proficiencyBonus: number;
  ac: { value: number; sources: Source[] };
  savingThrows: Record<Ability, SavingThrowResult>;
  skills: Record<Skill, SkillResult>;
  hitPoints: { max: number; hitDice: string; sources: Source[] };
  speed: { value: number; sources: Source[] };
  features: ResolvedFeature[];
  spellcasting?: { ability: Ability; saveDc: number; attackBonus: number; slots: Record<number, number> };
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
function resolveRollState(target: string, modifiers: readonly Modifier[]): RollState {
  const hasAdvantage = modifiers.some((m) => m.target === target && m.op === "advantage");
  const hasDisadvantage = modifiers.some((m) => m.target === target && m.op === "disadvantage");
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
  ];

  // Couche 1 : caracteristiques attribuees, plus couches 2/5 (espece, ASI/dons).
  const abilities = {} as Record<Ability, AbilityResult>;
  for (const ability of ABILITIES) {
    const { value, sources } = resolveTargetStack(
      `ability.${ability}`,
      allModifiers,
      build.abilities.assigned[ability],
      "Valeur attribuee",
    );
    abilities[ability] = { score: value, mod: abilityModifier(value), sources };
  }

  // Encombrement (couche 6) : depend du score de Force resolu ci-dessus,
  // ajoute donc ses propres modificateurs (vitesse, desavantage) apres coup
  // plutot que d'etre precalcule avec le reste — n'affecte jamais ability.*,
  // ac, ni hp.max, seulement savingThrows/skills/speed ci-dessous.
  const encumbrance = computeEncumbrance(abilities.str.score, carriedWeight);
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

  const skills = {} as Record<Skill, SkillResult>;
  for (const skill of SKILLS) {
    const target = `skill.${skill}`;
    const governing = SKILL_ABILITIES[skill];
    const expertise = allModifiers.some((m) => m.target === target && m.op === "expertise");
    const proficient = expertise || allModifiers.some((m) => m.target === target && m.op === "proficiency");
    const multiplier = expertise ? 2 : 1;
    const mod = abilities[governing].mod + (proficient ? proficiencyBonus * multiplier : 0);
    const sources: Source[] = [{ label: ABILITY_LABELS[governing], value: abilities[governing].mod }];
    if (proficient) sources.push({ label: expertise ? "Expertise" : "Maitrise", value: proficiencyBonus * multiplier });
    skills[skill] = {
      mod,
      proficiency: expertise ? "expertise" : proficient ? "proficient" : "none",
      rollState: resolveRollState(target, allModifiers),
      sources,
    };
  }

  const hitPoints = computeHitPoints(build, ruleset, abilities.con.mod, allModifiers);
  const speed = resolveTargetStack("speed", allModifiers, 30, "Vitesse de base");

  const grantedFeatureKeys = new Set(build.featureKeys);
  const warnings = features.flatMap((f) => checkPrerequisites(f, abilities, totalLevel, grantedFeatureKeys));

  let spellcasting: DerivedSheet["spellcasting"];
  for (const cl of build.classes) {
    const klass = ruleset.classes[cl.key];
    if (klass?.spellcasting) {
      const ability = klass.spellcasting.ability;
      spellcasting = {
        ability,
        saveDc: 8 + proficiencyBonus + abilities[ability].mod,
        attackBonus: proficiencyBonus + abilities[ability].mod,
        slots: klass.spellcasting.slotsByLevel[cl.level] ?? {},
      };
      break;
    }
  }

  return { abilities, proficiencyBonus, ac, savingThrows, skills, hitPoints, speed, features, spellcasting, warnings, encumbrance };
}
