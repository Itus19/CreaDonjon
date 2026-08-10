import type { Ability, Modifier } from "./sheet";

/**
 * Traduction des donnees SRD deja importees (ruleset_entries, V1-A1/A2)
 * vers les formes attendues par `characterSheet()` (V1-B1). Aucune
 * dependance reseau ici : ce module ne fait que lire des objets deja en
 * memoire (fonctions pures, testees).
 *
 * Les entrees SRD stockent leurs champs mecaniques dans un bloc
 * `custom_table` en paires {field, value}, chaque valeur etant le JSON
 * source (5e-bits) tel quel, en chaine — cf. specs/regles-blocs.md §5,
 * "l'echappatoire". `parseCustomTableFields` les redeserialise en objet
 * plat. Les noms de champs different parfois entre le SRD 2014 et 2024
 * (ex. `ability_bonuses` disparait en 2024, `starting_proficiencies`
 * devient `proficiencies`) — chaque extracteur tolere l'absence plutot que
 * d'echouer.
 */

const ABILITY_KEYS = new Set<Ability>(["str", "dex", "con", "int", "wis", "cha"]);

function isAbility(value: unknown): value is Ability {
  return typeof value === "string" && ABILITY_KEYS.has(value as Ability);
}

function skillKeyFromIndex(index: string): string | null {
  if (!index.startsWith("skill-")) return null;
  return index.slice("skill-".length).replace(/-/g, "_");
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export interface CustomTableRow {
  field: string;
  value: unknown;
}
export type ParsedFields = Record<string, unknown>;

export function parseCustomTableFields(rows: readonly CustomTableRow[]): ParsedFields {
  const result: ParsedFields = {};
  for (const row of rows) result[row.field] = tryParseJson(row.value);
  return result;
}

/** Couche 2 (§B4) : bonus de caracteristique et vitesse d'une espece. `ability_bonuses` absent (SRD 2024) => aucun modificateur de caracteristique, pas une erreur. */
export function mapSpeciesModifiers(fields: ParsedFields, source: string, label: string): Modifier[] {
  const modifiers: Modifier[] = [];

  const bonuses = fields.ability_bonuses;
  if (Array.isArray(bonuses)) {
    for (const b of bonuses as { ability_score?: { index?: string }; bonus?: number }[]) {
      const ability = b.ability_score?.index;
      if (isAbility(ability) && typeof b.bonus === "number") {
        modifiers.push({ target: `ability.${ability}`, op: "add", value: b.bonus, layer: 2, source, label });
      }
    }
  }

  const speed = fields.speed;
  if (typeof speed === "number") {
    modifiers.push({ target: "speed", op: "set", value: speed, layer: 2, source, label });
  }

  return modifiers;
}

export interface ClassCore {
  hitDie: number;
  savingThrowProficiencies: Ability[];
}

/** De de vie et maitrises de jets de sauvegarde d'une classe. */
export function mapClassCore(fields: ParsedFields): ClassCore {
  const hitDie = typeof fields.hit_die === "number" ? fields.hit_die : 6;
  const savesRaw = fields.saving_throws;
  const savingThrowProficiencies = Array.isArray(savesRaw)
    ? (savesRaw as { index?: string }[]).map((s) => s.index).filter(isAbility)
    : [];
  return { hitDie, savingThrowProficiencies };
}

/** Caracteristique d'incantation d'une classe, `null` si elle n'en lance pas. */
export function mapClassSpellcastingAbility(fields: ParsedFields): Ability | null {
  const spellcasting = fields.spellcasting as { spellcasting_ability?: { index?: string } } | undefined;
  const ability = spellcasting?.spellcasting_ability?.index;
  return isAbility(ability) ? ability : null;
}

export interface ProgressionRow {
  level: number;
  features?: { feature: string }[];
  [key: string]: unknown;
}

const MAX_SPELL_SLOT_LEVEL = 9;

/** Table d'emplacements de sort par niveau de classe, lue dans les colonnes `spellcasting_spell_slots_level_N` du bloc `class_progression` (deja importe, V1-A1). */
export function extractSlotsByLevel(rows: readonly ProgressionRow[]): Record<number, Record<number, number>> {
  const bySlotLevel: Record<number, Record<number, number>> = {};
  for (const row of rows) {
    const slots: Record<number, number> = {};
    for (let slotLevel = 1; slotLevel <= MAX_SPELL_SLOT_LEVEL; slotLevel++) {
      const value = row[`spellcasting_spell_slots_level_${slotLevel}`];
      if (typeof value === "number" && value > 0) slots[slotLevel] = value;
    }
    if (Object.keys(slots).length > 0) bySlotLevel[row.level] = slots;
  }
  return bySlotLevel;
}

/** Cles de feature accordees jusqu'a un niveau donne (colonne `features` du bloc `class_progression`) — affichage uniquement, ces cles n'ont pas forcement leurs propres modificateurs. */
export function extractFeatureKeysUpToLevel(rows: readonly ProgressionRow[], level: number): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    if (row.level <= level) {
      for (const f of row.features ?? []) keys.push(f.feature);
    }
  }
  return keys;
}

export interface SkillChoice {
  count: number;
  options: string[];
}

/** Choix de competences offerts par une classe (§B2), pour la liste des "choix restants" — pas encore les competences retenues. */
export function extractSkillChoices(fields: ParsedFields): SkillChoice[] {
  const choices = fields.proficiency_choices;
  if (!Array.isArray(choices)) return [];

  const result: SkillChoice[] = [];
  for (const c of choices as {
    choose?: number;
    type?: string;
    from?: { option_set_type?: string; options?: { item?: { index?: string } }[] };
  }[]) {
    if (c.type !== "proficiencies" || c.from?.option_set_type !== "options_array") continue;
    const options = (c.from.options ?? [])
      .map((o) => (o.item?.index ? skillKeyFromIndex(o.item.index) : null))
      .filter((s): s is string => s !== null);
    if (options.length > 0 && typeof c.choose === "number") {
      result.push({ count: c.choose, options });
    }
  }
  return result;
}

/** Competences retenues (§B2, `character.choices`) traduites en modificateurs de maitrise (couche 3). */
export function mapChosenSkillModifiers(skillKeys: readonly string[], source: string, label: string): Modifier[] {
  return skillKeys.map((skill) => ({ target: `skill.${skill}`, op: "proficiency", layer: 3, source, label }));
}

/** Competences accordees par un historique (couche 4). `starting_proficiencies` (SRD 2014) ou `proficiencies` (SRD 2024). */
export function mapBackgroundModifiers(fields: ParsedFields, source: string, label: string): Modifier[] {
  const raw = fields.starting_proficiencies ?? fields.proficiencies;
  if (!Array.isArray(raw)) return [];

  const modifiers: Modifier[] = [];
  for (const p of raw as { index?: string }[]) {
    const skill = p.index ? skillKeyFromIndex(p.index) : null;
    if (skill) modifiers.push({ target: `skill.${skill}`, op: "proficiency", layer: 4, source, label });
  }
  return modifiers;
}

/**
 * Les 16 langues standard du SRD (verifie identique contre `data/srd/srd-2014.json`
 * et `srd-2024.json`, categorie `Languages`) — meme statut que `ABILITIES`/`SKILLS`
 * (sheet.ts) : vocabulaire de base fige du systeme, pas une donnee importee.
 * Une variante avec des langues maison est hors perimetre tant qu'aucune UI
 * d'edition de regle n'existe (V1-D2) — importer `Languages` en `ruleset_entries`
 * pour ce seul cas aurait ete une generalisation prematuree (CLAUDE.md, "regle
 * des trois").
 */
export const SRD_LANGUAGES = [
  "common",
  "dwarvish",
  "elvish",
  "giant",
  "gnomish",
  "goblin",
  "halfling",
  "orc",
  "abyssal",
  "celestial",
  "draconic",
  "deep-speech",
  "infernal",
  "primordial",
  "sylvan",
  "undercommon",
] as const;
export type LanguageKey = (typeof SRD_LANGUAGES)[number];

export interface LanguageChoice {
  count: number;
}

/**
 * Choix de langues offert par un historique (V1-C7), ex. Acolyte : 2 parmi
 * toutes. Contrairement a `extractSkillChoices`, `language_options` ne porte
 * jamais de liste fixee dans l'entree elle-meme (`from.option_set_type` vaut
 * `"resource_list"`, pas `"options_array"`) — seul le nombre est lu ici,
 * l'appelant fournit `SRD_LANGUAGES` comme options.
 */
export function extractLanguageChoice(fields: ParsedFields): LanguageChoice | null {
  const raw = fields.language_options as { choose?: number; type?: string } | undefined;
  if (!raw || raw.type !== "languages" || typeof raw.choose !== "number") return null;
  return { count: raw.choose };
}

export interface ArmorData {
  category: string;
  base: number;
  dexBonus: boolean;
}

/** `null` si l'entree n'a pas de donnees d'armure exploitables (ex. une arme, ou un objet en ligne sans reference de regle). */
export function parseArmorData(fields: ParsedFields): ArmorData | null {
  const armorClass = fields.armor_class as { base?: number; dex_bonus?: boolean } | undefined;
  const category = fields.armor_category;
  if (!armorClass || typeof armorClass.base !== "number" || typeof category !== "string") return null;
  return { category, base: armorClass.base, dexBonus: armorClass.dex_bonus === true };
}

/**
 * Modificateur de CA d'une armure equipee (couche 6). Le bouclier s'ajoute
 * (jamais de Dex) ; l'armure lourde ecrase la base a une valeur fixe ; la
 * legere ajoute le modificateur de Dex complet ; la moyenne le plafonne a
 * +2 — regles standard, aucune formule ne peut l'exprimer plus simplement.
 */
export function armorAcModifier(armor: ArmorData, dexMod: number, source: string, label: string): Modifier {
  if (armor.category === "Shield") {
    return { target: "ac", op: "add", value: armor.base, layer: 6, source, label };
  }
  if (!armor.dexBonus) {
    return { target: "ac", op: "set", value: armor.base, layer: 6, source, label };
  }
  const cap = armor.category === "Medium" ? 2 : Infinity;
  return { target: "ac", op: "set", value: armor.base + Math.min(dexMod, cap), layer: 6, source, label };
}

export interface WeaponData {
  damageDice: string;
  damageType: string | null;
  /** Degats a deux mains si la propriete `versatile` est presente, `null` sinon. */
  versatileDamageDice: string | null;
  /** Cles `index` des proprietes (`finesse`, `light`, `versatile`, `two-handed`, `thrown`, `ammunition`, `heavy`, `reach`, `loading`, `monk`, `special`). */
  properties: string[];
  isRanged: boolean;
}

/**
 * `null` si l'entree n'a pas de donnees d'arme exploitables (ex. une
 * armure). Contrairement a l'armure, aucun bloc `weapon` dedie n'est jamais
 * ecrit a l'import (`scripts/ingest-srd.ts` n'a pas de `weaponBlocks()`) :
 * tout vit dans `custom_table`, exactement comme pour l'armure.
 */
export function parseWeaponData(fields: ParsedFields): WeaponData | null {
  const damage = fields.damage as { damage_dice?: string; damage_type?: { index?: string } } | undefined;
  if (!damage || typeof damage.damage_dice !== "string") return null;

  const twoHandedDamage = fields.two_handed_damage as { damage_dice?: string } | undefined;

  const propertiesRaw = fields.properties;
  const properties = Array.isArray(propertiesRaw)
    ? (propertiesRaw as { index?: string }[]).map((p) => p.index).filter((s): s is string => typeof s === "string")
    : [];

  // SRD 2014 : `weapon_range` ("Melee"/"Ranged"). SRD 2024 : ce champ
  // disparait, remplace par `equipment_categories` (ex. "Ranged Weapons").
  const isRanged =
    fields.weapon_range === "Ranged" ||
    (Array.isArray(fields.equipment_categories) &&
      (fields.equipment_categories as { name?: string }[]).some(
        (c) => typeof c.name === "string" && /ranged/i.test(c.name)
      ));

  return {
    damageDice: damage.damage_dice,
    damageType: typeof damage.damage_type?.index === "string" ? damage.damage_type.index : null,
    versatileDamageDice: typeof twoHandedDamage?.damage_dice === "string" ? twoHandedDamage.damage_dice : null,
    properties,
    isRanged,
  };
}

/**
 * Poids en livres d'un objet d'equipement (arme, armure, ou objet
 * quelconque) — champ `weight` partage par toutes les entrees `Equipment`
 * du SRD, identique en forme entre 2014 et 2024 (verifie contre les deux
 * fichiers). `null` si absent (contenu maison sans poids renseigne), jamais
 * une erreur.
 */
export function parseItemWeight(fields: ParsedFields): number | null {
  return typeof fields.weight === "number" ? fields.weight : null;
}

/**
 * Niveau d'un sort (0 = tour de magie, 1-9 sinon) — champ `level` partage par
 * les entrees `Spells` du SRD, identique en forme entre 2014 et 2024. `null`
 * si absent (contenu maison sans niveau renseigne).
 */
export function parseSpellLevel(fields: ParsedFields): number | null {
  return typeof fields.level === "number" ? fields.level : null;
}

export interface ProficiencyEntry {
  key: string;
  name: string;
}

/**
 * Maitrises d'armure/arme/outil accordees par une classe ou un historique
 * (onglet Traits, V1-C6) — exclut les competences (`skill-*`, deja
 * couvertes par `mapBackgroundModifiers`/`mapChosenSkillModifiers`) et les
 * jets de sauvegarde (`saving-throw-*`, deja couverts par `mapClassCore`).
 * Meme champ que `mapBackgroundModifiers` (`proficiencies` ou
 * `starting_proficiencies` selon l'edition), verifie melanger ces trois
 * natures d'entree dans le meme tableau (ex. `Classes.fighter.proficiencies`
 * du SRD 2014).
 */
export function mapProficiencies(fields: ParsedFields): ProficiencyEntry[] {
  const raw = fields.proficiencies ?? fields.starting_proficiencies;
  if (!Array.isArray(raw)) return [];
  return (raw as { index?: string; name?: string }[])
    .filter((p): p is { index: string; name?: string } => typeof p.index === "string")
    .filter((p) => !p.index.startsWith("skill-") && !p.index.startsWith("saving-throw-"))
    .map((p) => ({ key: p.index, name: p.name ?? p.index }));
}

export interface LanguageEntry {
  key: string;
  name: string;
}

/** Langues fixes accordees par une espece (onglet Traits, V1-C6) — champ `languages`, verifie identique en forme entre 2014 et 2024. Ne couvre pas les langues au choix d'un historique (`language_options`, structure de choix, pas une liste — hors perimetre). */
export function extractLanguages(fields: ParsedFields): LanguageEntry[] {
  const raw = fields.languages;
  if (!Array.isArray(raw)) return [];
  return (raw as { index?: string; name?: string }[])
    .filter((l): l is { index: string; name?: string } => typeof l.index === "string")
    .map((l) => ({ key: l.index, name: l.name ?? l.index }));
}
