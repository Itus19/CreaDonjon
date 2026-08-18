// Libelles francais destines a l'interface. Les identifiants techniques
// (colonnes, cles, types) restent en anglais snake_case (CLAUDE.md, regle
// absolue 11).
//
// V1-A1b : les libelles bilingues (coquille, types d'entree de regles)
// vivent desormais dans messages/fr.json et messages/en.json (next-intl).
// Ce fichier ne porte plus que ce qui n'a pas encore ete migre —
// RELATION_LABELS_FR reste francais uniquement pour l'instant, suivi a
// part (pas dans le perimetre de ce ticket).
//
// --- Ecriture inclusive (V1-C4, specs/arbitrage-modifications.md §3.9) ---
//
// Regle de redaction pour tout texte d'interface ecrit ici ou dans
// messages/fr.json, par ordre de preference :
//
//   1. Forme epicene — reformuler pour ne pas genrer du tout.
//      "l'equipe de jeu" plutot que "les joueur·se·s"
//      "qui possede ce personnage" plutot que "le·la proprietaire"
//   2. Si l'epicene est impossible, doublet complet.
//      "celles et ceux" plutot qu'un raccourci abrege.
//   3. Le point median est exclu, meme en dernier recours : les lecteurs
//      d'ecran le lisent de facon erratique, et c'est une vraie difficulte
//      pour les personnes dyslexiques. Raison technique d'accessibilite,
//      pas de posture — l'epicene est inclusif ET accessible, le point
//      median ne l'est qu'en apparence.
//
// Ceci concerne le texte d'interface (boutons, titres, messages). Le genre
// et les pronoms d'un PERSONNAGE sont une donnee du bloc `character`
// (`gender`/`pronouns`, src/core/schemas/blocks/character.ts), pas un
// choix de redaction — un texte genere qui met "il" sur un personnage
// `elle` est un bug de prompt IA, pas une fatalite (meme doc §3.9).

import type { Skill } from "@/src/core/rules/sheet";
import type { LanguageKey } from "@/src/core/rules/srdMapping";

/** Libelles officiels des competences (traduction SRD, cf. data/srd/fr-source). */
export const SKILL_LABELS_FR: Record<Skill, string> = {
  acrobatics: "Acrobaties",
  animal_handling: "Dressage",
  arcana: "Arcanes",
  athletics: "Athletisme",
  deception: "Tromperie",
  history: "Histoire",
  insight: "Intuition",
  intimidation: "Intimidation",
  investigation: "Investigation",
  medicine: "Medecine",
  nature: "Nature",
  perception: "Perception",
  performance: "Representation",
  persuasion: "Persuasion",
  religion: "Religion",
  sleight_of_hand: "Escamotage",
  stealth: "Discretion",
  survival: "Survie",
};

/** Libelles officiels des langues du SRD (V1-C7, cf. SRD_LANGUAGES). */
export const LANGUAGE_LABELS_FR: Record<LanguageKey, string> = {
  common: "Commun",
  dwarvish: "Nain",
  elvish: "Elfique",
  giant: "Geant",
  gnomish: "Gnome",
  goblin: "Gobelin",
  halfling: "Halfelin",
  orc: "Orque",
  abyssal: "Abyssal",
  celestial: "Celeste",
  draconic: "Draconique",
  "deep-speech": "Profond",
  infernal: "Infernal",
  primordial: "Primordial",
  sylvan: "Sylvestre",
  undercommon: "Sous-commun",
};

/** Libelles des modes de deplacement d'un monstre (`stat_block.speed`, cles SRD, V1-E4 retour utilisateur point 3). */
export const SPEED_LABELS_FR: Record<string, string> = {
  walk: "Marche",
  swim: "Nage",
  fly: "Vol",
  climb: "Escalade",
  burrow: "Fouissement",
};

/**
 * Traduction mot a mot de `stat_block.alignment` (V1-E4 retour utilisateur,
 * "Taille/Type/Alignement en encadres"). Le champ SRD n'est pas une valeur
 * fermee ("lawful evil", "unaligned", mais aussi "any non-good alignment"
 * ou "neutral good (50%) or neutral evil (50%)") — impossible a couvrir par
 * une table de correspondance exacte. Une substitution mot a mot (voir
 * `alignmentLabel`, blockContentRenderer.tsx) donne un resultat correct sur
 * les neuf alignements simples et lisible sur les formulations composees,
 * sans jamais inventer de texte absent de la source.
 */
export const ALIGNMENT_WORD_LABELS_FR: Record<string, string> = {
  lawful: "loyal",
  chaotic: "chaotique",
  neutral: "neutre",
  good: "bon",
  evil: "mauvais",
  unaligned: "sans alignement",
  any: "n'importe quel",
  alignment: "alignement",
  or: "ou",
};

/** Libelles des sens d'un monstre (`stat_block.senses`, cles SRD, V1-E4 retour utilisateur point 3). */
export const SENSE_LABELS_FR: Record<string, string> = {
  darkvision: "Vision dans le noir",
  blindsight: "Vue aveugle",
  tremorsense: "Perception des vibrations",
  truesight: "Vue veritable",
  passive_perception: "Perception passive",
};

/**
 * Libelles des proprietes d'arme (onglet Inventaire, V1-C11) — liste
 * complete verifiee contre `data/srd/srd-2014.json`/`srd-2024.json`
 * (`Weapon-Properties`, non importe comme categorie a part, cf.
 * `scripts/ingest-srd.ts` `SKIPPED_CATEGORIES` — ces cles n'ont donc pas de
 * fiche de regle propre, juste ce libelle statique, meme motif que
 * `SKILL_LABELS_FR`/`LANGUAGE_LABELS_FR`).
 */
export const WEAPON_PROPERTY_LABELS_FR: Record<string, string> = {
  ammunition: "Munitions",
  finesse: "Finesse",
  heavy: "Lourde",
  light: "Légère",
  loading: "Chargement",
  monk: "Moine",
  range: "Portée",
  reach: "Allonge",
  special: "Spéciale",
  thrown: "Lancer",
  "two-handed": "À deux mains",
  versatile: "Polyvalente",
};

/** Libelles des categories d'armure (`ArmorData.category`, onglet Inventaire, V1-C11) — valeurs verifiees identiques sur les deux editions. */
export const ARMOR_CATEGORY_LABELS_FR: Record<string, string> = {
  Light: "Legere",
  Medium: "Intermediaire",
  Heavy: "Lourde",
  Shield: "Bouclier",
};

/**
 * Libelles des types de degats (`weapon.damage.type`, `effects[].damage_type`,
 * `actions[].damage[].type` — meme cle brute anglaise partout, 13 valeurs
 * fermees). V1-D7, decouvert en passant sur Arme : ces trois blocs
 * affichaient encore la cle SRD brute ("piercing") entre parentheses a
 * cote de la formule de degats. Forme officielle reprise telle quelle de
 * la table « Types de degats » du glossaire francais (adjectif au pluriel
 * meme en position d'etiquette isolee, ex. "Perforants" pas "Perforant").
 */
export const DAMAGE_TYPE_LABELS_FR: Record<string, string> = {
  acid: "Acide",
  bludgeoning: "Contondants",
  cold: "Froid",
  fire: "Feu",
  force: "Force",
  lightning: "Foudre",
  necrotic: "Necrotiques",
  piercing: "Perforants",
  poison: "Poison",
  psychic: "Psychiques",
  radiant: "Radiants",
  slashing: "Tranchants",
  thunder: "Tonnerre",
};

/**
 * Qualificatifs composes de `stat_block.damage_resistances`/
 * `damage_vulnerabilities`/`damage_immunities` (V1-E4 retour utilisateur)
 * quand la valeur SRD n'est pas un simple type de degats mais une phrase
 * ("bludgeoning, piercing, and slashing from nonmagical weapons") — les 6
 * variantes qui existent dans le SRD 5.1 (`grep` sur les 334 monstres),
 * traduites mot pour mot une fois pour toutes plutot qu'une substitution
 * generique. Cle en minuscules, identique a la valeur brute du SRD.
 */
export const DAMAGE_QUALIFIER_LABELS_FR: Record<string, string> = {
  "bludgeoning, piercing, and slashing from nonmagical weapons": "Contondants, perforants et tranchants d'armes non magiques",
  "damage from spells": "Dégâts causés par les sorts",
  "bludgeoning, piercing, and slashing from nonmagical attacks (from stoneskin)":
    "Contondants, perforants et tranchants d'attaques non magiques (via Peau de pierre)",
  "bludgeoning, piercing, and slashing from nonmagical weapons that aren't silvered":
    "Contondants, perforants et tranchants d'armes non magiques qui ne sont pas en argent",
  "bludgeoning, piercing, and slashing from nonmagical weapons that aren't adamantine":
    "Contondants, perforants et tranchants d'armes non magiques qui ne sont pas en adamantite",
  "piercing and slashing from nonmagical weapons that aren't adamantine":
    "Perforants et tranchants d'armes non magiques qui ne sont pas en adamantite",
  "piercing from magic weapons wielded by good creatures": "Perforants d'armes magiques maniées par des créatures bonnes",
};

/** Libelles officiels des 15 conditions du SRD (`stat_block.condition_immunities`, memes 15 fiches que la barre laterale "CONDITION"). */
export const CONDITION_LABELS_FR: Record<string, string> = {
  Blinded: "Aveuglé",
  Charmed: "Charmé",
  Deafened: "Assourdi",
  Exhaustion: "Épuisement",
  Frightened: "Effrayé",
  Grappled: "Agrippé",
  Incapacitated: "Neutralisé",
  Invisible: "Invisible",
  Paralyzed: "Paralysé",
  Petrified: "Pétrifié",
  Poisoned: "Empoisonné",
  Prone: "À terre",
  Restrained: "Entravé",
  Stunned: "Étourdi",
  Unconscious: "Inconscient",
};

/**
 * Libelles des maitrises de `class_basics.armor_proficiencies`/
 * `weapon_proficiencies`/`tool_proficiencies` (V1-D3b point 3) —
 * vocabulaire ferme (23 valeurs distinctes sur les 12 classes de la SRD
 * 5.1), chaque terme verifie mot pour mot contre la section « Maîtrises »
 * de la classe qui l'emploie dans `data/srd/fr-source/srd-5.1-fr.txt`
 * (jamais une pluralisation deduite du nom d'arme singulier deja connu de
 * `ruleset_entries` type=weapon, qui aurait pu diverger de la formulation
 * reelle des classes). Cles conservees telles quelles depuis `source_raw`
 * (casse d'origine, y compris l'incoherence "All armor" avec un a
 * minuscule contrairement aux autres).
 */
export const CLASS_PROFICIENCY_LABELS_FR: Record<string, string> = {
  "All armor": "Toutes les armures",
  "Light Armor": "Armures légères",
  "Medium Armor": "Armures intermédiaires",
  Shields: "Boucliers",
  "Simple Weapons": "Armes courantes",
  "Martial Weapons": "Armes de guerre",
  Clubs: "Gourdin",
  "Crossbows, light": "Arbalète légère",
  Daggers: "Dague",
  Darts: "Fléchettes",
  "Hand crossbows": "Arbalète de poing",
  Javelins: "Javeline",
  Longswords: "Épée longue",
  Maces: "Masse d'armes",
  Quarterstaffs: "Bâton de combat",
  Rapiers: "Rapière",
  Scimitars: "Cimeterre",
  Shortswords: "Épée courte",
  Sickles: "Faucille",
  Slings: "Fronde",
  Spears: "Lance",
  "Herbalism Kit": "Matériel d'herboriste",
  "Thieves' Tools": "Outils de voleur",
  // V1-D7 (bloc `background`) : maitrise d'outil fixe des historiques Acolyte/Sage.
  "Calligrapher's Supplies": "Matériel de calligraphe",
};

/** Abreviations francaises des pieces de monnaie (onglet Inventaire, V1-C11) — la grille de monnaie du bloc Inventaire garde les codes SRD bruts (pp/gp/ep/sp/cp), non repris ici (hors perimetre de ce ticket). */
export const CURRENCY_LABELS_FR: Record<string, string> = {
  pp: "pp",
  gp: "po",
  ep: "pe",
  sp: "pa",
  cp: "pc",
};

/**
 * Types de creature du bloc `stat_block` (V1-D3) — les 14 types fermes du
 * SRD, chacun verifie contre `data/srd/fr-source/srd-5.1-fr.txt` (ligne
 * d'en-tete d'un vrai statblock, ex. "Humanoïde (gobelin) de taille P,
 * neutre mauvais" pour le Gobelin). `swarm of Tiny beasts` (2024 seulement,
 * quelques monstres) volontairement absent : le texte officiel l'exprime
 * par une construction complete ("Nuée de taille M de Bêtes de taille TP"),
 * pas un mot de vocabulaire substituable — reste en anglais plutot qu'une
 * reconstruction non verifiee.
 */
export const CREATURE_TYPE_LABELS_FR: Record<string, string> = {
  aberration: "Aberration",
  beast: "Bête",
  celestial: "Céleste",
  construct: "Artificiel",
  dragon: "Dragon",
  elemental: "Élémentaire",
  fey: "Fée",
  fiend: "Fiélon",
  giant: "Géant",
  humanoid: "Humanoïde",
  monstrosity: "Monstruosité",
  ooze: "Vase",
  plant: "Plante",
  undead: "Mort-vivant",
};

/** Tailles du bloc `stat_block` (V1-D3) — verifiees contre les abreviations officielles (TP/P/M/G/TG/Gig) du meme texte que CREATURE_TYPE_LABELS_FR. */
export const SIZE_LABELS_FR: Record<string, string> = {
  Tiny: "Très petit",
  Small: "Petit",
  Medium: "Moyen",
  Large: "Grand",
  Huge: "Très grand",
  Gargantuan: "Gigantesque",
};

/**
 * Raretes du bloc `item_properties` (V1-D3) — verifiees contre le chapitre
 * Objets magiques du texte officiel (ex. "Objet merveilleux, peu courant").
 * `Artifact` absent : aucune occurrence trouvee dans le texte SRD 5.1
 * extrait (rarete hors SRD, reservee au DMG) — reste en anglais plutot
 * qu'une traduction non verifiee. Seules les valeurs simples sont
 * remplacees ; une rarete composee ("Rare (+1), Very Rare (+2)...", objets
 * a bonus variable) reste telle quelle plutot qu'une substitution partielle
 * hasardeuse.
 */
export const ITEM_RARITY_LABELS_FR: Record<string, string> = {
  Common: "Courant",
  Uncommon: "Peu courant",
  Rare: "Rare",
  "Very Rare": "Très rare",
  Legendary: "Légendaire",
  Varies: "Variable",
};

export const RELATION_LABELS_FR: Record<string, string> = {
  parent_of: "parent de",
  child_of: "enfant de",
  sibling_of: "frere/sœur de",
  married_to: "marie(e) a",
  adopted_by: "adopte(e) par",
  adopted: "a adopte",
  ancestor_of: "ancetre de",
  descendant_of: "descendant(e) de",
  friend_of: "ami(e) de",
  rival_of: "rival(e) de",
  mentor_of: "mentor de",
  apprentice_of: "apprenti(e) de",
  serves: "sert",
  served_by: "servi(e) par",
  member_of: "membre de",
  has_member: "a pour membre",
  leads: "dirige",
  led_by: "dirige(e) par",
  part_of: "fait partie de",
  located_in: "situe(e) dans",
  contains: "contient",
  origin_of: "origine de",
  originates_from: "originaire de",
  owns: "possede",
  owned_by: "possede(e) par",
  created: "a cree",
  created_by: "cree(e) par",
  carries: "porte",
  carried_by: "porte(e) par",
  knows: "connait",
  loves: "aime",
  loved_by: "aime(e) par",
  hates: "deteste",
  hated_by: "deteste(e) par",
  participated_in: "a participe a",
  had_participant: "avec la participation de",
  witnessed: "a assiste a",
  witnessed_by: "vu par",
};

export const fr = { RELATION_LABELS_FR } as const;
