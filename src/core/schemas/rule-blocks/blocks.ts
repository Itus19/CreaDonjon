import { z } from "zod";
import { zFormulaNode, zLocalized, zModifier, zQuantity, zReference } from "./primitives";

/**
 * Catalogue V1 des blocs de regles (specs/regles-blocs.md §5). Cinq blocs
 * plus l'echappatoire couvrent 90% du SRD ; le reste (weapon, armor,
 * stat_block, ...) vient quand un cas concret le reclame — regle des trois.
 *
 * V1-D1 (12 aout) : le cas concret est arrive — le reste du SRD (armes,
 * armures, objets, monstres, classes) n'a encore que l'echappatoire
 * `custom_table` pour se representer. Onze blocs de plus, tous batis sur les
 * memes primitives et les memes six mises en page (aucun septieme layout,
 * aucun composant d'affichage nouveau — specs/regles-blocs.md §4). Ce ticket
 * ne touche pas l'import (`scripts/ingest-srd.ts`, V1-D2) : les fiches
 * restent "incompletes" pour ces types tant que l'import ne les remplit pas,
 * exactement comme weapon/stat_block le sont deja aujourd'hui.
 */

export const BLOCK_TYPES = [
  "description",
  "spell_casting",
  "effects",
  "scaling",
  "class_progression",
  "custom_table",
  "weapon",
  "armor",
  "item_properties",
  "charges",
  "stat_block",
  "traits",
  "actions",
  "legendary_actions",
  "prerequisites",
  "class_basics",
  "spellcasting_progression",
  "subclass_slot",
  "background",
  "condition_effects",
  "subclass_features",
  "species_traits",
  "class_equipment",
  "modifiers",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

// --- description (layout: prose) ---------------------------------------
// Segments narratifs. Le modele complet des segments porteurs de visibilite
// (wiki-liens-et-personnages.md) s'applique aux entites ; pour une fiche de
// regle importee du SRD, chaque segment est public par construction (aucun
// n'a de raison d'etre cache au moment de l'import).
export const zDescriptionBlockData = z.object({
  segments: z.array(z.object({ text: z.string() })),
  // Reference de page (V1-D5, specs/ruleset-personnel.md §1) : pour une
  // fiche d'un ruleset `personal_reference`, jamais de prose recopiee d'un
  // ouvrage sous droits — seulement "Voir tel manuel, page N." La distinction
  // qui commande tout : la mecanique se saisit, la prose se reference.
  // Optionnel et generique (pas reserve au personal_reference) : rien n'y
  // force la valeur a un ouvrage precis, cote schema.
  page_ref: z.string().optional(),
});
export type DescriptionBlockData = z.infer<typeof zDescriptionBlockData>;

// --- spell_casting (layout: key_values) ---------------------------------
export const zSpellCastingBlockData = z.object({
  level: z.number().int().min(0),
  school: z.string(),
  casting_time: z.string(),
  range: z.string(),
  components: z.array(z.enum(["V", "S", "M"])),
  material: z.string().optional(),
  duration: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
});
export type SpellCastingBlockData = z.infer<typeof zSpellCastingBlockData>;

// --- effects (layout: formula_list) -------------------------------------
export const zEffectData = z.object({
  id: z.string(),
  trigger: z.string().optional(),
  damage_type: z.string().optional(),
  formula: zFormulaNode.optional(),
  save: z.object({ ability: z.string(), effect_on_success: z.string().optional() }).optional(),
  // Jet d'attaque de sort (retour utilisateur, boutons d'action des sorts) —
  // exclusif avec `save` (le SRD ne pose jamais les deux sur un meme sort :
  // verifie sur les 339 sorts de la 5.2.1). `range` distingue melee/distance
  // comme `WeaponData.isRanged`, meme motif que les armes : determine la
  // caracteristique employee jamais separement du sort lui-meme.
  attack: z.object({ range: z.enum(["melee", "ranged"]) }).optional(),
});
export const zEffectsBlockData = z.object({
  effects: z.array(zEffectData),
});
export type EffectsBlockData = z.infer<typeof zEffectsBlockData>;

// --- scaling (layout: progression_table, specs/regles-blocs.md §6) -----
export const zScalingRule = z.object({
  kind: z.literal("delta_per_step"),
  target: z.string(),
  per_step: zFormulaNode,
});
export const zScalingBlockData = z.object({
  axis: z.enum(["slot_level", "character_level", "uses", "custom"]),
  base: z.number(),
  rule: zScalingRule.nullable(),
  // La table prime quand elle est presente (progression irreguliere) ;
  // c'est la forme que produit l'import SRD, dont les paliers sont deja
  // enumeres explicitement dans la donnee source (damage_at_slot_level).
  table: z.record(z.string(), z.string()).nullable(),
});
export type ScalingBlockData = z.infer<typeof zScalingBlockData>;

// --- class_progression (layout: progression_table, specs/regles-blocs.md §7) ---
export const zProgressionColumn = z.object({
  key: z.string(),
  label: zLocalized,
  kind: z.enum(["level", "formula", "grants", "value"]),
  formula: zFormulaNode.optional(),
});
export const zProgressionRow = z.record(z.string(), z.unknown());
export const zClassProgressionBlockData = z.object({
  max_level: z.number().int().positive(),
  columns: z.array(zProgressionColumn),
  rows: z.array(zProgressionRow),
});
export type ClassProgressionBlockData = z.infer<typeof zClassProgressionBlockData>;

// --- custom_table (layout: table) — l'echappatoire, des le premier jour ---
export const zCustomTableBlockData = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
});
export type CustomTableBlockData = z.infer<typeof zCustomTableBlockData>;

// --- weapon (layout: key_values, V1-D1) ---------------------------------
// Miroir du contrat de `parseWeaponData` (src/core/rules/srdMapping.ts),
// qui lisait ces memes faits depuis `custom_table` faute de bloc dedie —
// desormais un vrai bloc type, la lecture depuis `custom_table` devient
// l'exception plutot que la regle une fois l'import migre (V1-D2).
export const zWeaponBlockData = z.object({
  category: z.enum(["simple", "martial"]),
  is_ranged: z.boolean(),
  damage: z.object({ dice: zFormulaNode, type: z.string().optional() }),
  // Degats a deux mains si la propriete `versatile` est presente.
  versatile_damage: zFormulaNode.optional(),
  // `kind: "rule"`, `key: "weapon-property-<index>"` — meme prefixe anti-collision que l'import (V1-C12).
  properties: z.array(zReference),
  // `key: "weapon-mastery-<index>"` (V1-D7, retour utilisateur) — meme motif de prefixe anti-collision
  // que `properties` ci-dessus (l'index brut, ex. "slow", percute le sort Lenteur sans lui).
  // Optionnel au niveau du schema (toute arme 2024 en a une, verifie contre les 38 armes de la SRD,
  // mais rien ne garantit qu'une arme maison future en porte une).
  mastery: zReference.optional(),
  range: z.object({ normal: zQuantity, long: zQuantity.optional() }).optional(),
  weight: zQuantity.optional(),
  cost: zQuantity.optional(),
});
export type WeaponBlockData = z.infer<typeof zWeaponBlockData>;

// --- armor (layout: key_values, V1-D1) ----------------------------------
// Miroir du contrat de `parseArmorData` (src/core/rules/srdMapping.ts).
export const zArmorBlockData = z.object({
  category: z.enum(["light", "medium", "heavy", "shield"]),
  base_ac: z.number().int(),
  dex_bonus: z.boolean(),
  max_dex_bonus: z.number().int().optional(),
  strength_minimum: z.number().int().optional(),
  stealth_disadvantage: z.boolean().optional(),
  weight: zQuantity.optional(),
  cost: zQuantity.optional(),
});
export type ArmorBlockData = z.infer<typeof zArmorBlockData>;

// --- item_properties (layout: key_values, V1-D1) ------------------------
// Bloc unique partage par les trois entry_type "objet" (item, magic_item,
// mount — V1-D7, retour utilisateur explicite : "un bloc d'objet qui va
// pour tout les objets") : chaque champ optionnel n'apparait que sur les
// fiches concernees, jamais un bloc different par categorie. Champs ajoutes
// en V1-D7 : `attunement_restriction` (SRD `limited-to`, ex. "Nain ou
// creature en Harmonie avec une Ceinture de force naine" — 23 objets sur
// 262 en portent une, jusque-la perdue), `capacity` (uniquement les
// montures — texte brut deja mis en forme cote SRD, ex. "450 lb.", jamais
// reparse), `contents` (paquetages d'aventurier, reference vers chaque
// objet inclus, meme forme que `background.equipment_options[].items`).
// Recherche faite avant d'ecrire ce bloc : aucun champ "longueur"/"largeur"/
// "capacite de contenant" structure dans le SRD (une echelle "10 pieds de
// haut" ou un sac "jusqu'a 30 livres" ne vivent que dans le texte libre de
// description) — pas de champ invente pour une donnee qui n'existe nulle
// part de facon structuree.
// `damage`/`save` ajoutes sur retour utilisateur (V1-D7 : "acide... besoin
// de champ de degats... ou de jet de sauvegarde") — decision explicite de
// les poser directement sur item_properties plutot que de reutiliser le
// bloc `effects` des Sorts (dont le champ `save` n'est lui-meme rempli nulle
// part dans le projet, meme pas par Boule de feu). `save.dc` reste une
// chaine plutot qu'un FormulaNode : pour la plupart de ces objets (Acide,
// Feu gregeois, Eau benite) le DD depend du lanceur ("8 + bonus de maitrise
// + modificateur de Dexterite"), une formule relative au personnage jamais
// serialisee nulle part dans le projet — seuls les DD fixes poses par
// l'objet lui-meme (Chausse-trappes, Piege a machoires : DD 15/13) auraient
// pu etre un nombre, mais un type mixte str/number aurait complique la
// lecture pour un gain nul. Seuls les objets ou le SRD precise reellement
// ces informations en portent — jamais devine pour un objet qui n'a que
// des degats "a l'impact" sans mecanique de jet (ex. Huile, conditionnelle
// a un embrasement ulterieur, volontairement laissee hors de ce bloc).
export const zItemDamageData = z.object({
  formula: zFormulaNode,
  damage_type: z.string().optional(),
});
export const zItemSaveData = z.object({
  ability: z.string(),
  dc: z.string(),
  effect_on_success: z.string().optional(),
});

export const zItemPropertiesBlockData = z.object({
  weight: zQuantity.optional(),
  cost: zQuantity.optional(),
  rarity: z.string().optional(),
  requires_attunement: z.boolean().optional(),
  attunement_restriction: z.string().optional(),
  category: z.string().optional(),
  capacity: z.string().optional(),
  contents: z.array(z.object({ ref: zReference.optional(), label: z.string(), quantity: z.number().int().positive() })).optional(),
  damage: zItemDamageData.optional(),
  save: zItemSaveData.optional(),
});
export type ItemPropertiesBlockData = z.infer<typeof zItemPropertiesBlockData>;

// --- charges (layout: key_values, V1-D1) --------------------------------
// Optionnel : seuls les objets rechargeables (baguettes, batons) en ont.
// Jamais dans REQUIRED_BLOCKS — la plupart des objets n'en ont pas, un
// bloc absent ici n'est pas une lacune.
export const zChargesBlockData = z.object({
  max: z.number().int().positive(),
  regain: z.string().optional(),
  depleted_effect: z.string().optional(),
});
export type ChargesBlockData = z.infer<typeof zChargesBlockData>;

// --- stat_block (layout: key_values, V1-D1) -----------------------------
export const zStatBlockAbilities = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  con: z.number().int(),
  int: z.number().int(),
  wis: z.number().int(),
  cha: z.number().int(),
});
export const zStatBlockBlockData = z.object({
  size: z.string(),
  creature_type: z.string(),
  alignment: z.string().optional(),
  armor_class: z.number().int(),
  hit_points: z.number().int(),
  hit_dice: z.string(),
  speed: z.record(z.string(), z.string()),
  abilities: zStatBlockAbilities,
  saving_throws: z.array(z.object({ ability: z.string(), bonus: z.number().int() })).optional(),
  skills: z.array(z.object({ name: z.string(), bonus: z.number().int() })).optional(),
  damage_vulnerabilities: z.array(z.string()).optional(),
  damage_resistances: z.array(z.string()).optional(),
  damage_immunities: z.array(z.string()).optional(),
  condition_immunities: z.array(z.string()).optional(),
  senses: z.record(z.string(), z.string()).optional(),
  languages: z.string().optional(),
  challenge_rating: z.number(),
  proficiency_bonus: z.number().int(),
  // Optionnel : jamais stocke a l'extraction initiale (V1-D3b), injecte a la
  // lecture depuis `ruleset_entries.source_raw.xp` (V1-E3, retour utilisateur
  // — le SRD porte cette valeur pour chaque monstre, elle manquait a
  // l'affichage). Jamais une valeur inventee si absente de la source.
  xp: z.number().optional(),
});
export type StatBlockBlockData = z.infer<typeof zStatBlockBlockData>;

// --- traits (layout: key_values, V1-D1) ---------------------------------
// Aptitudes speciales d'un monstre (ex. Pack Tactics) — jamais dans
// REQUIRED_BLOCKS : beaucoup de creatures de faible FP n'en ont aucune,
// un bloc absent n'est pas une lacune.
export const zTraitEntry = z.object({ name: z.string(), description: z.string() });
export const zTraitsBlockData = z.object({ traits: z.array(zTraitEntry) });
export type TraitsBlockData = z.infer<typeof zTraitsBlockData>;

// --- actions (layout: key_values, V1-D1) --------------------------------
export const zActionEntry = z.object({
  name: z.string(),
  description: z.string(),
  attack_bonus: z.number().int().optional(),
  damage: z.array(z.object({ dice: zFormulaNode, type: z.string().optional() })).optional(),
});
export const zActionsBlockData = z.object({ actions: z.array(zActionEntry) });
export type ActionsBlockData = z.infer<typeof zActionsBlockData>;

// --- legendary_actions (layout: key_values, V1-E4b) ---------------------
// Meme forme que `actions` (le SRD porte les memes champs `attack_bonus`/
// `damage` sur une action legendaire qui attaque directement, ex. "Tail
// Swipe" d'un dragon) — jamais dans REQUIRED_BLOCKS, la plupart des
// monstres n'en ont aucune.
export const zLegendaryActionsBlockData = z.object({ actions: z.array(zActionEntry) });
export type LegendaryActionsBlockData = z.infer<typeof zLegendaryActionsBlockData>;

// --- prerequisites (layout: chips, V1-D1) -------------------------------
// Optionnel : la plupart des dons/sous-classes n'ont pas de prerequis.
// Texte court plutot qu'une structure — les formes varient trop (score
// minimum, niveau, caracteristique d'incantation) pour une seule primitive
// sans en inventer une onzieme (specs/regles-blocs.md §3, a eviter).
export const zPrerequisitesBlockData = z.object({ items: z.array(z.string()) });
export type PrerequisitesBlockData = z.infer<typeof zPrerequisitesBlockData>;

// --- modifiers (layout: key_values) --------------------------------------
// Generalisation du moteur de fiche derivee (retour utilisateur : "un don
// maison qui affecte reellement la fiche, pas seulement du texte") — jusque
// la, `resolvedRuleset.ts` ne lisait des `Modifier[]` que pour Espece/
// Historique, codes en dur par mapper SRD (`mapSpeciesModifiers`/
// `mapBackgroundModifiers`) ; toute aptitude generique (`entry_type:
// "feature"`, dons compris, meme "Vigilant" du SRD) resolvait `modifiers:
// []`. Ce bloc est le chemin generique : n'importe quelle fiche `feature`
// peut desormais en porter un, lu par `resolvedRuleset.ts` et transforme en
// vrais `Modifier[]` via `resolveDeclaredModifiers` (src/core/rules/sheet.ts),
// qui attache source/etiquette/couche selon la provenance de la feature —
// jamais stockes ici (`zModifier` ne porte que cible/effet/valeur).
export const zModifiersBlockData = z.object({ modifiers: z.array(zModifier) });
export type ModifiersBlockData = z.infer<typeof zModifiersBlockData>;

// --- class_basics (layout: key_values, V1-D1) ---------------------------
export const zClassBasicsBlockData = z.object({
  hit_die: z.number().int().positive(),
  saving_throw_proficiencies: z.array(z.string()),
  armor_proficiencies: z.array(z.string()).optional(),
  weapon_proficiencies: z.array(z.string()).optional(),
  tool_proficiencies: z.array(z.string()).optional(),
});
export type ClassBasicsBlockData = z.infer<typeof zClassBasicsBlockData>;

// --- spellcasting_progression (layout: key_values, V1-D1) ---------------
// Optionnel : seules les classes qui incantent en ont (pas Guerrier/Barbare
// en base SRD) — jamais dans REQUIRED_BLOCKS pour `class`.
export const zSpellcastingInfoEntry = z.object({ name: z.string(), description: z.string() });
export const zSpellcastingProgressionBlockData = z.object({
  ability: z.string(),
  starts_at_level: z.number().int().positive(),
  info: z.array(zSpellcastingInfoEntry),
});
export type SpellcastingProgressionBlockData = z.infer<typeof zSpellcastingProgressionBlockData>;

// --- subclass_slot (layout: key_values, V1-D1) --------------------------
// A quel niveau et sous quel nom une classe choisit sa sous-classe
// (ex. "Tradition arcanique" au niveau 2 pour le Magicien).
export const zSubclassSlotBlockData = z.object({
  label: z.string(),
  chosen_at_level: z.number().int().positive(),
  options: z.array(zReference).optional(),
});
export type SubclassSlotBlockData = z.infer<typeof zSubclassSlotBlockData>;

// --- background (layout: key_values, V1-D7) -----------------------------
// Donnees mecaniques d'un historique : valeurs de caracteristique, don
// accorde, maitrises, equipement de depart. Le don est une vraie reference
// (`zReference`, kind "rule", categorie SRD "Feats" -> entry_type
// "feature") pour permettre un affichage resolu (nom + description reprise
// de sa propre fiche, cf. resolveFeatDetail dans rules.ts) — c'est le seul
// champ de premier niveau qui pointe vers une fiche existante. Les
// maitrises de competence/outil n'ont PAS d'entree dediee dans ce systeme
// (categorie "Skills" absente de CATEGORY_ENTRY_TYPE, scripts/ingest-srd.ts) :
// simples libelles, meme choix que `class_basics.tool_proficiencies` deja
// en place.
//
// `equipment_options` (V1-D7, sur retour utilisateur — remplace un premier
// jet en texte libre) reprend fidelement la forme du SRD (toujours "choisir
// A ou B", chaque option une liste d'objets + un montant d'or optionnel) :
// chaque objet EST une reference (`kind: "rule"`) des qu'il correspond a une
// vraie fiche Objet/Arme importee (le cas courant, verifie sur les 4
// historiques), pour un rendu en encadres inspire de l'onglet Inventaire de
// la fiche jouable (meme langage visuel, demande explicite) avec liens
// resolus plutot qu'un texte fige. `label` reste toujours rempli en repli
// (jamais de reference : un choix de categorie, ex. "un type de boite de
// jeux" pour le Soldat, qui ne designe aucun objet precis).
export const zBackgroundEquipmentItem = z.object({
  ref: zReference.optional(),
  label: z.string(),
  quantity: z.number().int().positive(),
  // Membres reels d'une categorie SRD ("au choix" — ex. Symbole sacre :
  // Amulette/Embleme/Reliquaire), retour utilisateur V2-G1. Present
  // uniquement quand `ref` est absent (jamais les deux a la fois) : le SRD
  // structure deja `Equipment-Categories[].equipment` comme une vraie liste
  // de fiches Objet/Arme importees, jamais un texte fige seul.
  category_options: z.array(zReference).optional(),
});
export const zBackgroundEquipmentOption = z.object({
  label: z.string(),
  items: z.array(zBackgroundEquipmentItem),
  gold: zQuantity.optional(),
});
export const zBackgroundBlockData = z.object({
  ability_scores: z.array(z.string()).length(3),
  feat: zReference,
  skill_proficiencies: z.array(z.string()),
  tool_proficiency: z.string().optional(),
  equipment_options: z.array(zBackgroundEquipmentOption).min(1),
});
export type BackgroundEquipmentItem = z.infer<typeof zBackgroundEquipmentItem>;
export type BackgroundEquipmentOption = z.infer<typeof zBackgroundEquipmentOption>;
export type BackgroundBlockData = z.infer<typeof zBackgroundBlockData>;

// --- condition_effects (layout: key_values, V1-D7) ----------------------
// Effets d'une condition (ex. Neutralisé, Vitesse 0 pour Agrippé), un
// nom + un texte par effet — meme forme que `traits` (aptitudes de
// monstre), mais type distinct plutot que reutilise (sur retour explicite
// de l'utilisateur : un futur formulaire MJ "creer une condition" doit
// rester nomme comme tel, pas comme "creer des aptitudes"). Toujours
// requis (REQUIRED_BLOCKS.condition) : une condition sans aucun effet
// n'a pas de sens, contrairement aux aptitudes de monstre qui sont
// legitimement absentes pour beaucoup de creatures.
export const zConditionEffectEntry = z.object({ name: z.string(), description: z.string() });
export const zConditionEffectsBlockData = z.object({ effects: z.array(zConditionEffectEntry) });
export type ConditionEffectsBlockData = z.infer<typeof zConditionEffectsBlockData>;

// --- subclass_features (layout: key_values, V1-D7) -----------------------
// Aptitudes qu'une sous-classe accorde, par niveau (ex. Domaine de la Vie :
// Disciple de la vie au niveau 3) — le SRD les porte directement sur
// l'entree sous-classe elle-meme (`features: [{name, level, description}]`),
// contrairement aux traits de monstre qui n'ont pas de niveau. Type
// distinct de `traits`/`condition_effects` (meme raison qu'eux : un futur
// formulaire MJ "creer une sous-classe" reste nomme comme tel). Toujours
// requis : une sous-classe sans aptitude n'a pas de sens.
export const zSubclassFeatureEntry = z.object({ name: z.string(), level: z.number().int().positive(), description: z.string() });
export const zSubclassFeaturesBlockData = z.object({ features: z.array(zSubclassFeatureEntry) });
export type SubclassFeaturesBlockData = z.infer<typeof zSubclassFeaturesBlockData>;

// --- species_traits (layout: key_values, V1-D7) --------------------------
// Traits d'une espece, ou d'une sous-espece (ascendance/lignee/heritage
// choisis au sein d'une espece, ex. "Ascendance draconique (Noir)") : la
// 5.2.1 ne porte pas d'entry_type distinct pour les secondes, contrairement
// a Classe/Sous-classe — seule la presence de `source_raw.species` (lue
// cote service, RuleEntrySummary.parentSpeciesKey) les distingue. Chaque
// trait EST une reference (`kind: "rule"`, categorie SRD "Traits" ->
// entry_type "feature", meme fiche que celles deja utilisees par les
// monstres) plutot qu'un nom+texte duplique : resolu a la lecture
// (ResolvedSpeciesTraitsBlockData, rules.ts), meme motif que
// `weapon.properties`. `creature_type`/`sizes`/`speed`/`lifespan` optionnels :
// absents pour une sous-espece (elle n'a pas sa propre taille/vitesse/
// esperance de vie, juste des traits supplementaires).
//
// `sizes` (V1-D7, retour utilisateur : "certaines especes peuvent avoir
// plusieurs tailles possibles, ex. Humain") — tableau plutot qu'un champ
// unique : Humain et Tieffelin ont chacun le choix entre Moyenne et Petite
// (texte officiel verifie dans srd-5.2.1-fr.txt, ex. Humain : « M (moyenne,
// entre 1,20 m et 2,10 m) ou P (petite, de 60 cm a 1,20 m) »). `range` vient
// exclusivement du texte source francais (jamais du JSON anglais source,
// verifie incomplet sur ce point precis : `Species.human.size` n'y vaut que
// "Medium", sans le second choix pourtant present dans le texte officiel).
//
// `lifespan` (V1-D7, retour utilisateur) — absent du SRD (aucune mention
// d'esperance de vie dans le texte officiel des deux editions, verifie) :
// valeurs de reference fournies directement par l'utilisateur, jamais
// "official_srd" comme le reste de ce bloc — memes valeurs mixtes officiel/
// invente qu'un `background` (feat officiel + lore invente sur la meme ligne
// de traduction).
export const zSpeciesSizeOption = z.object({ label: z.string(), range: z.string().optional() });
export const zSpeciesTraitsBlockData = z.object({
  creature_type: z.string().optional(),
  sizes: z.array(zSpeciesSizeOption).optional(),
  speed: zQuantity.optional(),
  lifespan: z.string().optional(),
  traits: z.array(zReference),
});
export type SpeciesTraitsBlockData = z.infer<typeof zSpeciesTraitsBlockData>;

// --- class_equipment (layout: key_values, V2-G1) ------------------------
// Equipement de depart d'une classe (retour utilisateur : "il manque les
// objets de depart dans la fiche de regle des classes", point 9 de la
// passe V2-G1) — le SRD porte deux champs distincts, contrairement a un
// historique qui n'a qu'un unique choix "A ou B" :
//
//   - `fixed` (`starting_equipment`) : objets TOUJOURS accordes, sans
//     choix (ex. le Grimoire du Magicien). Absent pour une classe qui n'a
//     que des choix (verifie : le Magicien 2024 n'a AUCUN `starting_equipment`,
//     seulement des `starting_equipment_options`).
//   - `choices` (`starting_equipment_options`) : plusieurs choix
//     INDEPENDANTS l'un de l'autre (ex. Magicien 2014 : "baton de combat OU
//     dague", PUIS separement "besace a composants OU focaliseur", PUIS
//     "sac d'erudit OU sac d'explorateur" — trois choix, pas un seul).
//     Chaque choix reutilise `zBackgroundEquipmentOption` (memes objets,
//     memes references resolues, meme `gold` optionnel) : un choix de
//     classe n'est jamais qu'un historique avec un nombre d'options
//     different, la meme forme suffit sans variante.
export const zClassEquipmentChoice = z.object({ options: z.array(zBackgroundEquipmentOption).min(1) });
export const zClassEquipmentBlockData = z.object({
  fixed: z.array(zBackgroundEquipmentItem),
  choices: z.array(zClassEquipmentChoice),
});
export type ClassEquipmentChoice = z.infer<typeof zClassEquipmentChoice>;
export type ClassEquipmentBlockData = z.infer<typeof zClassEquipmentBlockData>;

// --- Enveloppe commune (specs/regles-blocs.md §2) -----------------------
export const zBlockDisplay = z.object({
  label: z.string(),
  layout: z.enum(["key_values", "progression_table", "formula_list", "prose", "chips", "table"]),
  collapsed: z.boolean().optional(),
});

const DATA_SCHEMA_BY_BLOCK_TYPE = {
  description: zDescriptionBlockData,
  spell_casting: zSpellCastingBlockData,
  effects: zEffectsBlockData,
  scaling: zScalingBlockData,
  class_progression: zClassProgressionBlockData,
  custom_table: zCustomTableBlockData,
  weapon: zWeaponBlockData,
  armor: zArmorBlockData,
  item_properties: zItemPropertiesBlockData,
  charges: zChargesBlockData,
  stat_block: zStatBlockBlockData,
  traits: zTraitsBlockData,
  actions: zActionsBlockData,
  legendary_actions: zLegendaryActionsBlockData,
  prerequisites: zPrerequisitesBlockData,
  class_basics: zClassBasicsBlockData,
  spellcasting_progression: zSpellcastingProgressionBlockData,
  subclass_slot: zSubclassSlotBlockData,
  background: zBackgroundBlockData,
  condition_effects: zConditionEffectsBlockData,
  subclass_features: zSubclassFeaturesBlockData,
  species_traits: zSpeciesTraitsBlockData,
  class_equipment: zClassEquipmentBlockData,
  modifiers: zModifiersBlockData,
} satisfies Record<BlockType, z.ZodTypeAny>;

/** Registre : le moteur demande le schema Zod d'un block_type et recoit une forme garantie. */
export function dataSchemaForBlockType(blockType: BlockType): z.ZodTypeAny {
  return DATA_SCHEMA_BY_BLOCK_TYPE[blockType];
}

export function validateBlockData(blockType: BlockType, data: unknown) {
  return dataSchemaForBlockType(blockType).parse(data);
}
