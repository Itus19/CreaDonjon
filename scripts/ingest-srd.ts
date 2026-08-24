// Import du SRD (P0-08) : charge data/srd/srd-2014.json et data/srd/srd-2024.json vers
// rulesets + ruleset_entries + ruleset_entry_blocks, sur le projet
// Supabase configure par NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
//
// Lancement : npm run ingest:srd
//
// Le contournement du verrou is_official_base est explicite et localise
// dans les fonctions Postgres app.import_upsert_ruleset / app.import_srd_entries
// (migration 20260730180001, renvois derives ajoutes en 20260802110001) et
// app.import_prune_stale_entries (migration 20260802100001) : ce script ne
// fait jamais de set_config lui-meme, il appelle des RPC qui l'encapsulent.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  type BackgroundEquipmentOption,
  type BlockType,
  type EntryType,
  validateBlockData,
} from "../src/core/schemas/rule-blocks";
import { parseFormula } from "../src/core/formula";
import type { FormulaNode } from "../src/core/formula/ast";
import { extractDerivedRefs, type DerivedRef } from "../src/core/rules/refs";
import {
  mapClassCore,
  parseArmorData,
  parseItemCost,
  parseItemWeight,
  parseWeaponData,
} from "../src/core/rules/srdMapping";

interface ConversionFailure {
  rulesetFile: string;
  category: string;
  entryKey: string;
  entryName: string;
  message: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definies (voir .env.local)."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --------------------------------------------------------------------
// Types minimaux des donnees SRD brutes utilisees par ce script (le reste
// des champs traverse tel quel vers le bloc custom_table).
// --------------------------------------------------------------------

type SrdRecord = Record<string, unknown>;

interface EntryBlock {
  block_type: BlockType;
  display: { label: string; layout: string; collapsed?: boolean };
  data: unknown;
  display_order?: number;
}

interface TransformedEntry {
  entry_key: string;
  entry_type: EntryType;
  ai_digest: string;
  source_attribution: string;
  // Objet JSON source integral (specs/outils-mj.md §1) : le generateur de
  // rencontres et le suivi d'initiative (V2) auront besoin de champs (CR,
  // XP, CA, PV...) non encore transformes en blocs. Le garder maintenant
  // evite un reimport complet le jour ou on en a besoin.
  source_raw: SrdRecord;
  blocks: EntryBlock[];
  // Renvois derives de la structure des blocs (V1-A3, SCHEMA.md §9.3) —
  // recalcules a chaque import, jamais les renvois `declared` (voir
  // app.import_srd_entries, migration 20260802110001).
  refs: DerivedRef[];
}

interface SrdVersionConfig {
  file: string;
  baseSystem: "dnd_srd_51" | "dnd_srd_52";
  rulesetName: string;
  sourceAttribution: string;
  /**
   * srd-2024.json n'est pas un document autonome : c'est un jeu de
   * modifications/ajouts par rapport a 2014 (indique par l'utilisateur,
   * confirme par les donnees — pas de categorie "Spells" du tout, "Monsters"
   * reduit a 3 entrees). Quand ce champ est present, le jeu de donnees
   * complet est reconstruit en partant de `file` de base et en appliquant
   * les entrees de ce fichier par-dessus, index par index (voir
   * buildMergedDataset).
   */
  mergeWithBaseFile?: string;
}

const SRD_VERSIONS: SrdVersionConfig[] = [
  {
    file: "data/srd/srd-2014.json",
    baseSystem: "dnd_srd_51",
    rulesetName: "SRD 5.1 (2014)",
    sourceAttribution: "SRD 5.1",
  },
  {
    file: "data/srd/srd-2024.json",
    baseSystem: "dnd_srd_52",
    rulesetName: "SRD 5.2.1 (2024)",
    sourceAttribution: "SRD 5.2.1",
    mergeWithBaseFile: "data/srd/srd-2014.json",
  },
];

/**
 * Categories renommees entre 2014 et 2024 : meme concept, cle differente.
 * Utilise pour aligner les deux jeux de donnees lors de la fusion.
 */
const CATEGORY_RENAMES_2014_TO_2024: Record<string, string> = {
  Races: "Species",
  Subraces: "Subspecies",
};

/**
 * Index 2014 (categorie cible post-renommage -> index) a exclure de la base
 * avant fusion : mergeByIndex ne peut reconnaitre un remplacement que si les
 * DEUX jeux de donnees partagent le meme `index` (ex. cloaker/cloaker). Sans
 * cette exclusion, un concept consolide ou retire en 2024 reste visible sous
 * ruleset 5.2.1 avec sa mecanique 2014 — silencieusement, la meme classe de
 * bug a chaque fois. Chaque entree ci-dessous verifiee mot pour mot dans
 * data/srd/fr-source/srd-5.2.1-fr.txt avant d'etre ajoutee, jamais une
 * famille exclue en bloc sur la seule absence de surcharge 2024 (V1-D3b,
 * dix-septieme passe : une premiere tentative d'exclure "toutes les
 * Invocations occultes" a ete corrigee a temps — 25 des ~40 avaient en fait
 * deja un nom francais verifie, preuve qu'elles existent bien en 2024 sous
 * un sous-titre propre, seule une partie du catalogue avait ete verifiee
 * absente lors d'une passe anterieure).
 */
const SUPERSEDED_2014_INDICES: Record<string, Set<string>> = {
  // V1-D3b sixieme passe : lignages d'espece.
  //  - high-elf / rock-gnome : doublon confirme, le contenu 2024 existe bel
  //    et bien mais sous elven-lineage-high-elf / gnomish-lineage-rock-gnome.
  //  - half-elf / half-orc / hill-dwarf / lightfoot-halfling : aucun
  //    equivalent 2024 sous quelque cle que ce soit (retrait de contenu
  //    confirme par lecture directe du chapitre Especes, ligne 8291-8438 :
  //    Halfelin et Nain n'ont plus de table de sous-lignage, Demi-elfe/
  //    Demi-orc n'apparaissent nulle part).
  Species: new Set(["half-elf", "half-orc"]),
  Subspecies: new Set(["high-elf", "rock-gnome", "hill-dwarf", "lightfoot-halfling"]),
  // V1-D3b dix-septieme passe : aptitudes consolidees en une seule fiche
  // generique en 2024 (verifie par lecture directe du chapitre de classe
  // concerne, jamais par la seule absence de surcharge) ou par famille dont
  // le mecanisme par couleur a disparu (Sorcellerie draconique 2024, deja
  // confirme au point 10 neuvieme passe).
  Features: new Set([
    "bardic-inspiration-d6", "bardic-inspiration-d8", "bardic-inspiration-d10", "bardic-inspiration-d12",
    "channel-divinity-1-rest", "channel-divinity-2-rest", "channel-divinity-3-rest",
    "destroy-undead-cr-1-2-or-below", "destroy-undead-cr-1-or-below", "destroy-undead-cr-2-or-below",
    "destroy-undead-cr-3-or-below", "destroy-undead-cr-4-or-below",
    "natural-explorer-1-terrain-type", "natural-explorer-2-terrain-types", "natural-explorer-3-terrain-types",
    "brutal-critical-1-die", "brutal-critical-2-dice", "brutal-critical-3-dice",
    "song-of-rest-d6", "song-of-rest-d8", "song-of-rest-d10", "song-of-rest-d12",
    "dragon-ancestor",
    "dragon-ancestor-black---acid-damage", "dragon-ancestor-blue---lightning-damage",
    "dragon-ancestor-brass---fire-damage", "dragon-ancestor-bronze---lightning-damage",
    "dragon-ancestor-copper---acid-damage", "dragon-ancestor-gold---fire-damage",
    "dragon-ancestor-green---poison-damage", "dragon-ancestor-red---fire-damage",
    "dragon-ancestor-silver---cold-damage", "dragon-ancestor-white---cold-damage",
  ]),
  // V1-D3b dix-huitieme passe (volet Objet) : trois motifs distincts, chacun
  // confirme par lecture directe de data/srd/fr-source/srd-5.2.1-fr.txt avant
  // exclusion — jamais sur la seule absence de surcharge JSON (celle-ci s'est
  // revelee a plusieurs reprises incomplete par rapport au texte officiel
  // reellement publie, ex. la table "Montures et vehicules" existe en clair
  // dans le texte mais n'a aucune trace dans data/srd/srd-2024.json ; ces
  // entrees-la sont un vrai trou de contenu, pas un phantome, et restent hors
  // de cette liste) :
  //  - doublon d'index confirme (mergeByIndex ne l'a pas reconnu car WotC a
  //    change l'index entre editions, ex. cartographers-tools/2014 vs
  //    cartographer-tools/2024) : le nouvel index a deja son propre
  //    ruleset_entries verifie et traduit ailleurs.
  //  - variante par couleur/tier consolidee en une seule fiche generique avec
  //    table de conversion interne (Ceinturon/Potion de force de geant,
  //    Anneau/Potion de resistance, Ecailles de dragon, Gemme elementaire,
  //    Manuel des golems, Corne de Valhalla, Parchemin de sort par niveau,
  //    Tapis volant par taille, Pierre de bonne fortune, tiers de Potion de
  //    guerison) : verifie table par table, jamais suppose par famille —
  //    a distinguer des familles qui ONT une sous-fiche individuelle malgre
  //    un index JSON partage (Pierre d'Ioun, Anneau de commandement
  //    elementaire, Sac a malices, Figurine merveilleuse, Plume magique :
  //    verifiees a l'identique et confirmees NON exclues, chacune garde son
  //    propre sous-titre en gras dans le texte).
  //  - contenu mineur reellement absent du texte 2024 (confirme par recherche
  //    directe, aucune trace nulle part) : petits objets de remplissage 2014
  //    sans equivalent (craie, savon, sablier...), et Barde par type
  //    d'armure individuel, remplace par une regle generique a prix/poids
  //    calcules (x4 prix, x2 poids de l'armure equivalente, ligne 9801-9807).
  Equipment: new Set([
    // V1-D3b vingt-deuxieme passe (volet Arme, decouvert en verifiant
    // Classe/Condition/Armure/Arme/Historique) : meme motif que
    // cartographer-tools/dungeoneer-pack en dix-neuvieme passe, l'ordre des
    // mots de l'index a change (crossbow-heavy -> heavy-crossbow) sans rien
    // changer au contenu — chaque fiche 2024 reelle deja traduite sous le
    // meme nom francais exact (Arbalete lourde/legere/de poing).
    "crossbow-heavy", "crossbow-light", "crossbow-hand",
    // V1-D3b vingt-quatrieme passe (volet Objet, montures/vehicules) : les
    // 24 fiches reelles du meme chapitre ont ete importees (voir
    // scripts/data/new-mounts-vehicles-2024-en.json) — celles-ci, en
    // revanche, confirmees absentes des tables "Mounts and Other Animals"/
    // "Tack, Harness, and Drawn Vehicles" de srd-5.2.1-en.txt (verifie ligne
    // 6780-6873) : donkey n'apparait plus dans la table des montures
    // (seulement Camel/Elephant/Horse/Mastiff/Mule/Pony/Warhorse, 8 entrees
    // exactement) ; saddle-pack et saddlebags ont disparu du texte entier
    // (recherche "saddlebag" ne trouve plus qu'une mention du Sac a dos
    // pouvant en tenir lieu, ligne 6566 — plus de fiche a part entiere).
    "donkey", "saddle-pack", "saddlebags",
    // V1-D3b vingt-cinquieme passe (residu Objet, dernier lot) : deux motifs
    // distincts, chacun verifie contre srd-5.2.1-en.txt (liste complete des
    // 131 objets generiques 2024) puis contre le texte francais avant
    // exclusion.
    //  - doublon d'index confirme par recoupement cout/poids/quantite EXACT
    //    (meme motif que cartographer-tools/heavy-crossbow) : 2024 a
    //    simplifie l'intitule ("Wooden staff"->"Staff", "Crossbow bolt"->
    //    "Bolts", "Blowgun needle"->"Needles", "Sling bullet"->"Bullets,
    //    Sling", "Playing Card Set"->"Playing Cards", "Dice Set"->"Dice",
    //    "Jug or pitcher"->"Jug", "Flask or tankard"->"Flask") — chaque
    //    fiche 2024 reelle deja traduite sous le nom francais deja etabli.
    "wooden-staff", "crossbow-bolt", "blowgun-needle", "sling-bullet",
    "playing-card-set", "dice-set", "jug-or-pitcher", "flask-or-tankard",
    //  - confirme reellement absent : aucune occurrence dans la liste
    //    complete des objets generiques 2024 ni dans une recherche directe
    //    du texte francais (marteau/masse/petit couteau/pierre a aiguiser/
    //    balance de marchand/encensoir/bloc d'encens, zero resultat).
    "hammer", "hammer-sledge", "small-knife", "whetstone", "scale-merchants",
    "censer", "block-of-incense",
    "abacus", "acid-vial", "alchemists-fire-flask", "alms-box", "antitoxin-vial", "arrow",
    "ball-bearings-bag-of-1000",
    "barding-breastplate", "barding-chain-mail", "barding-chain-shirt", "barding-half-plate",
    "barding-hide", "barding-leather", "barding-padded", "barding-plate", "barding-ring-mail",
    "barding-scale-mail", "barding-splint", "barding-studded-leather",
    "bit-and-bridle", "cartographers-tools", "chain-10-feet", "chalk-1-piece", "clothes-costume",
    "diplomats-pack", "dungeoneers-pack", "fishing-tackle", "holy-water-flask", "hourglass",
    "ink-1-ounce-bottle", "ladder-10-foot", "little-bag-of-sand", "mess-kit", "mirror-steel",
    "oil-flask", "paper-one-sheet", "parchment-one-sheet", "perfume-vial", "pick-miners", "piton",
    "poison-basic-vial", "pole-10-foot", "rations-1-day", "robes", "rope-hempen-50-feet",
    "rope-silk-50-feet", "sealing-wax", "signet-ring", "soap", "spike-iron", "string-10-feet",
    "tent-two-person", "totem", "vestments",
  ]),
  "Magic-Items": new Set([
    // V1-D3b vingt-cinquieme passe : aucune occurrence de "Restorative
    // Ointment"/"Onguent reparateur"/"Onguent restaurateur" ni dans le JSON
    // ni dans le texte francais — confirme reellement absent, pas une
    // simple absence de correspondance.
    "restorative-ointment",
    "belt-of-giant-strength-cloud", "belt-of-giant-strength-fire", "belt-of-giant-strength-frost",
    "belt-of-giant-strength-hill", "belt-of-giant-strength-stone", "belt-of-giant-strength-storm",
    "carpet-of-flying-3x5", "carpet-of-flying-4x6", "carpet-of-flying-5x7", "carpet-of-flying-6x9",
    "dragon-scale-mail-black", "dragon-scale-mail-blue", "dragon-scale-mail-brass",
    "dragon-scale-mail-bronze", "dragon-scale-mail-copper", "dragon-scale-mail-gold",
    "dragon-scale-mail-green", "dragon-scale-mail-red", "dragon-scale-mail-silver",
    "dragon-scale-mail-white",
    "elemental-gem-air", "elemental-gem-earth", "elemental-gem-fire", "elemental-gem-water",
    "horn-of-valhalla-brass", "horn-of-valhalla-bronze", "horn-of-valhalla-iron", "horn-of-valhalla-silver",
    "manual-of-golems-clay", "manual-of-golems-flesh", "manual-of-golems-iron", "manual-of-golems-stone",
    "potion-of-giant-strength-cloud", "potion-of-giant-strength-fire", "potion-of-giant-strength-frost",
    "potion-of-giant-strength-hill", "potion-of-giant-strength-stone", "potion-of-giant-strength-storm",
    "potion-of-healing", "potion-of-healing-common", "potion-of-healing-greater",
    "potion-of-healing-superior", "potion-of-healing-supreme",
    "potion-of-resistance-acid", "potion-of-resistance-cold", "potion-of-resistance-fire",
    "potion-of-resistance-force", "potion-of-resistance-lightning", "potion-of-resistance-necrotic",
    "potion-of-resistance-poison", "potion-of-resistance-psychic", "potion-of-resistance-radiant",
    "potion-of-resistance-thunder",
    "ring-of-resistance-acid", "ring-of-resistance-cold", "ring-of-resistance-fire",
    "ring-of-resistance-force", "ring-of-resistance-lightning", "ring-of-resistance-necrotic",
    "ring-of-resistance-poison", "ring-of-resistance-psychic", "ring-of-resistance-radiant",
    "ring-of-resistance-thunder",
    "spell-scroll-1st", "spell-scroll-2nd", "spell-scroll-3rd", "spell-scroll-4th", "spell-scroll-5th",
    "spell-scroll-6th", "spell-scroll-7th", "spell-scroll-8th", "spell-scroll-9th",
    "spell-scroll-cantrip", "stone-of-good-luck-luckstone",
  ]),
  // V1-D3b vingtieme passe (volet Monstre) : sur les ~40 candidats, seuls ces
  // 12 sont confirmes absents du texte 2024 apres recherche directe dans
  // data/srd/fr-source/srd-5.2.1-fr.txt (chapitre Bestiaire, ligne 26545+) —
  // aucune trace, sous aucun nom alternatif plausible teste. Les 28 autres
  // candidats (formes de lycanthrope/vampire, familles Gobelin/Gobelours/
  // Hobgobelin par role, Gros-bras, Incube/Succube, Demi-dragon, Piranha et
  // ses nuees, Nuee de serpents venimeux, Tapis etrangleur...) se sont averes
  // REELS : nommement confirmes comme fiches de statistiques a part entiere
  // dans le texte officiel, simplement absents de data/srd/srd-2024.json (le
  // meme trou methodologique deja trouve pour Objet — Montures et vehicules
  // — mais a une echelle bien plus grande ici). Ne jamais les purger : ce
  // sont des fiches a importer, pas des fantomes a supprimer (V1-D3b, point
  // d'etape).
  Monsters: new Set([
    "drow", "duergar", "lizardfolk", "tribal-warrior", "deep-gnome-svirfneblin",
    "giant-rat-diseased", "minotaur", "orc",
    "swarm-of-wasps", "swarm-of-centipedes", "swarm-of-spiders", "swarm-of-beetles",
    // V1-D3b vingt-troisieme passe : les ~30 fiches reelles importees depuis
    // le texte anglais (voir extraction dediee, scripts/data/new-monsters-2024-en.json)
    // rendent ces fantomes 2014 reellement superflus desormais — impossible
    // avant, faute de remplacement reel en base. Chaque remplacement
    // confirme individuellement (nom francais deja verifie + mecanique
    // recoupee), jamais suppose par famille.
    "werewolf-wolf", "werewolf-human", "werewolf-hybrid",
    "werebear-bear", "werebear-human", "werebear-hybrid",
    "wererat-rat", "wererat-human", "wererat-hybrid",
    "wereboar-boar", "wereboar-human", "wereboar-hybrid",
    "weretiger-tiger", "weretiger-human", "weretiger-hybrid",
    "vampire-vampire", "vampire-mist", "vampire-bat",
    "goblin", "bugbear", "hobgoblin", "thug", "succubus-incubus",
    "quipper", "swarm-of-quippers", "swarm-of-poisonous-snakes", "rug-of-smothering",
  ]),
  // V1-D3b vingt-et-unieme passe (volet Sous-classe) : cas le plus simple des
  // quatre categories purgees — doublon d'index confirme pour les 9, WotC
  // ayant systematiquement rallonge l'index 2024 d'un qualificatif (domain,
  // patron, sorcery, of-the-berserker...) sans creer de nouveau concept.
  // Chaque paire verifiee : le nom francais deja traduit du cote 2014
  // correspond thematiquement a la fiche 2024 reelle deja traduite
  // separement (ex. life -> Domaine de la Vie == life-domain -> Domaine de
  // la Vie), jamais suppose par la seule ressemblance de nom.
  Subclasses: new Set([
    "lore", "life", "fiend", "evocation", "open-hand", "draconic",
    "berserker", "land", "devotion",
  ]),
};

/**
 * Fusionne deux tableaux d'objets SRD par leur `index` stable : les
 * elements de `overrides` remplacent entierement ceux de `base` partageant
 * le meme index (jamais un merge champ par champ — une revision 2024 d'un
 * sort est un texte complet, pas un patch), les elements de base sans
 * correspondance sont conserves tels quels, et les elements de overrides
 * sans correspondance sont ajoutes. `excludedBaseIndices` retire des elements
 * de base AVANT la fusion (SUPERSEDED_2014_INDICES) : un remplacement
 * confirme sous une cle differente, jamais une simple absence de recoupement.
 */
function mergeByIndex(base: SrdRecord[], overrides: SrdRecord[], excludedBaseIndices?: Set<string>): SrdRecord[] {
  const byIndex = new Map<string, SrdRecord>();
  for (const item of base) {
    if (excludedBaseIndices?.has(String(item.index))) continue;
    byIndex.set(String(item.index), item);
  }
  for (const item of overrides) byIndex.set(String(item.index), item);
  return [...byIndex.values()];
}

/**
 * Reconstruit un jeu de donnees SRD 2024 complet : base 2014 + surcharges
 * et ajouts 2024, categorie par categorie (avec alignement des renommages).
 */
function buildMergedDataset(
  base: Record<string, SrdRecord[]>,
  overrides: Record<string, SrdRecord[]>
): Record<string, SrdRecord[]> {
  const merged: Record<string, SrdRecord[]> = {};

  for (const [baseCategory, baseItems] of Object.entries(base)) {
    const targetCategory = CATEGORY_RENAMES_2014_TO_2024[baseCategory] ?? baseCategory;
    merged[targetCategory] = mergeByIndex(
      baseItems,
      overrides[targetCategory] ?? [],
      SUPERSEDED_2014_INDICES[targetCategory]
    );
  }

  const handledTargets = new Set(Object.keys(merged));
  for (const [category, items] of Object.entries(overrides)) {
    if (!handledTargets.has(category)) merged[category] = items;
  }

  return merged;
}

// --------------------------------------------------------------------
// Categories reference/enum du SRD : utilisees par d'autres entrees
// (ecole de magie d'un sort, propriete d'une arme...) mais ne sont pas,
// elles-memes, des ruleset_entries — aucun entry_type ferme (SCHEMA.md §9)
// ne leur correspond, et ce ne sont pas des regles qu'on consulte comme un
// sort ou un monstre. Ecarte deliberement (regle des trois) plutot que
// d'elargir le schema pour un besoin qui n'existe pas encore.
//
// `Weapon-Properties` a quitte cette liste (V1-C12, sur retour utilisateur) :
// besoin reel des qu'un joueur veut savoir ce que "finesse"/"legere" veulent
// dire depuis la fiche d'un objet — chaque entree porte un vrai `desc` SRD
// (verifie), importee comme `Traits`/`Feats` (`entry_type: "feature"`, meme
// motif). `Weapon-Mastery-Properties` l'a rejointe (V1-D7, retour utilisateur
// explicite : "il manque les bottes d'armes dans un bloc a part") — meme
// motif exact, chaque entree porte elle aussi un vrai `desc` SRD.
// --------------------------------------------------------------------
const SKIPPED_CATEGORIES = new Set([
  "Ability-Scores",
  "Alignments",
  "Damage-Types",
  "Equipment-Categories",
  "Languages",
  "Levels", // consomme via Classes pour class_progression, pas importe seul
  "Magic-Schools",
  "Proficiencies",
  "Skills",
]);

// --------------------------------------------------------------------
// Utilitaires de transformation
// --------------------------------------------------------------------

function truncateForDigest(text: string, maxChars = 480): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}…` : clean;
}

/** Cherche une prose exploitable dans les formes rencontrees dans le SRD (desc: string[] | string, description: string). */
function extractProse(entry: SrdRecord): string | null {
  const desc = entry.desc;
  if (Array.isArray(desc)) return desc.join("\n\n");
  if (typeof desc === "string" && desc.trim() !== "") return desc;
  const description = entry.description;
  if (typeof description === "string" && description.trim() !== "") return description;
  return null;
}

/**
 * Repli du digest quand `extractProse` ne trouve rien (`ai_digest`, colonne
 * de contexte IA, jamais traduite — voir docs/SCHEMA.md §9.1) : espece et
 * historique n'ont aucune prose narrative dans les donnees SRD elles-memes
 * (verifie sur les deux editions, `data/srd/srd-2014.json` et
 * `srd-2024.json`) — sans ce repli, `digestSource` retombait sur
 * `entry.name`, produisant un digest du type "Half-Elf (species) — Half-Elf"
 * (nom repete, aucune information). Reste invisible tant qu'aucun tour
 * d'affichage ne le montre en permanence — c'etait le cas jusqu'a V1-C9
 * (fiche jouable, onglet Traits), qui l'affiche desormais toujours, pas
 * seulement en infobulle.
 *
 * Construit un resume factuel a partir des memes champs structures que
 * `src/core/rules/srdMapping.ts` (`ability_bonuses`, `speed`, `traits`,
 * `starting_proficiencies`/`proficiencies`, `feat`, `feature`) — pas une
 * reutilisation directe de ces fonctions, qui produisent des `Modifier[]`
 * numeriques pour le moteur, pas du texte. Les deux editions n'ont pas le
 * meme jeu de champs (2014 espece a `ability_bonuses`, 2024 non ; 2014
 * historique a `feature.desc`, 2024 a `feat` a la place) — chaque partie est
 * donc optionnelle, silencieusement omise si absente plutot que supposee.
 */
function fallbackDigestFacts(entryType: EntryType, entry: SrdRecord): string | null {
  if (entryType === "species") {
    const parts: string[] = [];

    const speed = entry.speed;
    if (typeof speed === "number") parts.push(`Speed ${speed} ft.`);

    const bonuses = entry.ability_bonuses;
    if (Array.isArray(bonuses) && bonuses.length > 0) {
      const names = (bonuses as { ability_score?: { name?: string }; bonus?: number }[])
        .filter((b) => typeof b.ability_score?.name === "string" && typeof b.bonus === "number")
        .map((b) => `${b.ability_score!.name} +${b.bonus}`);
      if (names.length > 0) parts.push(`Ability bonuses: ${names.join(", ")}.`);
    }

    const traits = entry.traits;
    if (Array.isArray(traits) && traits.length > 0) {
      const names = (traits as { name?: string }[]).map((t) => t.name).filter((n): n is string => typeof n === "string");
      if (names.length > 0) parts.push(`Traits: ${names.join(", ")}.`);
    }

    return parts.length > 0 ? parts.join(" ") : null;
  }

  if (entryType === "background") {
    const parts: string[] = [];

    const proficiencies = entry.starting_proficiencies ?? entry.proficiencies;
    if (Array.isArray(proficiencies) && proficiencies.length > 0) {
      const names = (proficiencies as { name?: string }[]).map((p) => p.name).filter((n): n is string => typeof n === "string");
      if (names.length > 0) parts.push(`Proficiencies: ${names.join(", ")}.`);
    }

    const feature = entry.feature as { name?: string } | undefined;
    if (typeof feature?.name === "string") parts.push(`Feature: ${feature.name}.`);

    const feat = entry.feat as { name?: string } | undefined;
    if (typeof feat?.name === "string") parts.push(`Grants the ${feat.name} feat.`);

    return parts.length > 0 ? parts.join(" ") : null;
  }

  return null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface FeatureDedup {
  /** entry_key original (specifique a une classe) -> entry_key canonique. Identite si l'entree n'a pas de doublon. */
  canonicalKeyByOriginalKey: Map<string, string>;
  /** Une entree brute par groupe canonique, index reecrit sur la cle canonique. */
  canonicalEntries: SrdRecord[];
}

/**
 * La categorie Features du SRD modelise chaque aptitude generique une fois
 * par classe et par niveau : "Ability Score Improvement" apparait ainsi 63
 * fois (2014 seul), texte strictement identique, seul l'index differe
 * (barbarian-ability-score-improvement-1, fighter-..., etc). Ce n'est pas une
 * erreur d'import, c'est la structure meme de la donnee source — mais le
 * wiki ne doit afficher qu'une seule fiche pour un seul mecanisme.
 *
 * Le regroupement se fait sur (nom, texte) strictement identiques, jamais
 * sur le nom seul : "Divine Domain feature" apparait aussi plusieurs fois
 * mais avec un contenu reellement distinct par classe (ou par palier) — ce
 * n'est pas un doublon, et cette regle le laisse intact (groupe a un seul
 * membre, cle inchangee).
 */
function dedupeFeatures(items: SrdRecord[]): FeatureDedup {
  const groups = new Map<string, SrdRecord[]>();
  for (const item of items) {
    const name = String(item.name ?? "");
    const prose = extractProse(item) ?? "";
    const groupKey = `${name}::${prose}`;
    const group = groups.get(groupKey);
    if (group) group.push(item);
    else groups.set(groupKey, [item]);
  }

  const canonicalKeyByOriginalKey = new Map<string, string>();
  const canonicalEntries: SrdRecord[] = [];
  const usedKeys = new Set(items.map((item) => String(item.index)));

  for (const groupItems of groups.values()) {
    const representative = groupItems[0];
    const originalKey = String(representative.index);

    if (groupItems.length === 1) {
      canonicalKeyByOriginalKey.set(originalKey, originalKey);
      canonicalEntries.push(representative);
      continue;
    }

    const baseSlug = slugify(String(representative.name ?? originalKey));
    let canonicalKey = baseSlug;
    let suffix = 2;
    while (usedKeys.has(canonicalKey)) {
      canonicalKey = `${baseSlug}-${suffix++}`;
    }
    usedKeys.add(canonicalKey);
    for (const item of groupItems) {
      canonicalKeyByOriginalKey.set(String(item.index), canonicalKey);
    }
    canonicalEntries.push({ ...representative, index: canonicalKey });
  }

  return { canonicalKeyByOriginalKey, canonicalEntries };
}

function descriptionBlock(text: string): EntryBlock {
  const data = { segments: [{ text }] };
  validateBlockData("description", data);
  return {
    block_type: "description",
    display: { label: "Description", layout: "prose" },
    data,
    display_order: 100,
  };
}

/** L'echappatoire (specs/regles-blocs.md §5) : rien de la donnee source n'est perdu, meme sans schema type dedie. */
function customTableBlock(entry: SrdRecord): EntryBlock {
  const rows = Object.entries(entry)
    .filter(([key]) => key !== "url")
    .map(([field, value]) => ({
      field,
      value: typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value),
    }));
  const data = { columns: ["field", "value"], rows };
  validateBlockData("custom_table", data);
  return {
    block_type: "custom_table",
    display: { label: "Donnees brutes (SRD)", layout: "table", collapsed: true },
    data,
    display_order: 900,
  };
}

/**
 * Parse une notation de des SRD ("8d6", "3d4 + 3"...) en FormulaNode. Le SRD
 * contient parfois du texte libre a cette place (rare) ; un echec de parsing
 * n'est pas fatal, l'effet reste alors sans formule plutot que de faire
 * echouer toute l'entree — c'est a l'appelant de le consigner.
 */
function tryParseDiceFormula(text: string) {
  try {
    return parseFormula(text);
  } catch {
    return undefined;
  }
}

function spellBlocks(entry: SrdRecord): EntryBlock[] {
  const blocks: EntryBlock[] = [];

  const spellCastingData = {
    level: Number(entry.level ?? 0),
    school: String((entry.school as SrdRecord | undefined)?.name ?? "unknown"),
    casting_time: String(entry.casting_time ?? ""),
    range: String(entry.range ?? ""),
    components: Array.isArray(entry.components) ? (entry.components as string[]) : [],
    material: typeof entry.material === "string" ? entry.material : undefined,
    duration: String(entry.duration ?? ""),
    concentration: Boolean(entry.concentration),
    ritual: Boolean(entry.ritual),
  };
  validateBlockData("spell_casting", spellCastingData);
  blocks.push({
    block_type: "spell_casting",
    display: { label: "Incantation", layout: "key_values" },
    data: spellCastingData,
    display_order: 200,
  });

  const damage = entry.damage as SrdRecord | undefined;
  if (damage) {
    const damageType = (damage.damage_type as SrdRecord | undefined)?.name;

    // Deux formes de montee en puissance existent dans le SRD, mutuellement
    // exclusives : les sorts avec emplacement (damage_at_slot_level, indexee
    // par niveau d'emplacement, palier de base = niveau du sort) et les tours
    // de magie (damage_at_character_level, indexee par niveau de personnage,
    // palier de base = niveau 1). Avant cette version, seule la premiere
    // etait lue : un tour de magie comme Fire Bolt n'avait donc aucune
    // progression du tout.
    const slotLevels = damage.damage_at_slot_level as Record<string, string> | undefined;
    const charLevels = damage.damage_at_character_level as Record<string, string> | undefined;

    const baseLevelKey = slotLevels ? String(entry.level ?? 0) : "1";
    const baseFormulaText = slotLevels?.[baseLevelKey] ?? charLevels?.[baseLevelKey];

    const effectsData = {
      effects: [
        {
          id: "e1",
          damage_type: typeof damageType === "string" ? damageType : undefined,
          formula: baseFormulaText ? tryParseDiceFormula(baseFormulaText) : undefined,
        },
      ],
    };
    validateBlockData("effects", effectsData);
    blocks.push({
      block_type: "effects",
      display: { label: "Effets", layout: "formula_list" },
      data: effectsData,
      display_order: 300,
    });

    if (slotLevels && Object.keys(slotLevels).length > 0) {
      const scalingData = {
        axis: "slot_level" as const,
        base: Number(entry.level ?? 0),
        rule: null,
        table: slotLevels,
      };
      validateBlockData("scaling", scalingData);
      blocks.push({
        block_type: "scaling",
        display: { label: "Montee en puissance", layout: "progression_table" },
        data: scalingData,
        display_order: 400,
      });
    } else if (charLevels && Object.keys(charLevels).length > 0) {
      const scalingData = {
        axis: "character_level" as const,
        base: 1,
        rule: null,
        table: charLevels,
      };
      validateBlockData("scaling", scalingData);
      blocks.push({
        block_type: "scaling",
        display: { label: "Montee en puissance", layout: "progression_table" },
        data: scalingData,
        display_order: 400,
      });
    }
  }

  return blocks;
}

/**
 * Libelles FR des colonnes dynamiques de `class_progression` (V1-D7, sur
 * retour utilisateur implicite — decouvertes non traduites, ex.
 * "cantrips_known" affiche tel quel comme en-tete de colonne). Cles
 * derivees de `class_specific`/`spellcasting` (5e-bits), enumerees en
 * verifiant les 12 classes de base des deux editions — completee au besoin
 * si une classe maison en introduit une nouvelle (repli sur la cle brute).
 */
const CLASS_SPECIFIC_COLUMN_LABELS_FR: Record<string, string> = {
  bardic_inspiration_die: "De d'Inspiration bardique",
  channel_divinity_charges: "Utilisations de Conduit divin",
  eldritch_invocations: "Invocations occultes",
  favored_enemies: "Ennemis jures",
  focus_points: "Points de Credo",
  martial_arts_die: "De d'Arts martiaux",
  rage_count: "Rages",
  rage_damage_bonus: "Bonus aux degats de Rage",
  second_wind_uses: "Utilisations de Second souffle",
  sneak_attack: "Attaque sournoise",
  sorcery_points: "Points de Sorcellerie",
  unarmored_movement_bonus: "Bonus de Deplacement sans armure",
  weapon_mastery: "Maitrise des armes",
  wild_shape_uses: "Utilisations de Forme sauvage",
};
const SPELLCASTING_COLUMN_LABELS_FR: Record<string, string> = {
  cantrips_known: "Sorts mineurs connus",
  prepared_spells: "Sorts prepares",
};

/** Table de progression generique a partir de Levels (§7 de regles-blocs.md), colonnes derivees des cles rencontrees plutot que codees en dur par classe. */
function classProgressionBlock(
  classIndex: string,
  levels: SrdRecord[],
  remapFeatureKey: Map<string, string>,
  sourceAttribution: string
): EntryBlock {
  const rawLevels = levels
    .filter((l) => (l.class as SrdRecord | undefined)?.index === classIndex)
    .sort((a, b) => Number(a.level) - Number(b.level));

  // Maitrise d'armes de Paladin/Rodeur/Roublard (SRD 2024 UNIQUEMENT, retour
  // utilisateur V2-G1) : leur `class_specific` ne porte JAMAIS
  // `weapon_mastery`, contrairement a Barbare/Guerrier — verifie sur les
  // cinq classes, leur texte de capacite ne mentionne d'ailleurs aucune
  // progression (invariant "deux" du niveau 1 au niveau 20, jamais un
  // "trois" a un palier comme Barbare/Guerrier). Injecte ici plutot qu'en
  // aval (resolvedRuleset.ts) : les trois suivent alors EXACTEMENT le meme
  // chemin de lecture que Barbare/Guerrier (`class_progression`, colonne
  // `class_specific_weapon_mastery`), aucun repli special-case necessaire
  // cote serveur. Garde `sourceAttribution === "SRD 5.2.1"` explicite : la
  // maitrise d'armes n'existe pas du tout sous 2014, un Paladin 2014 (meme
  // `classIndex`) ne doit jamais en heriter. Copie plutot que mutation de
  // `lvl` : `levels` reste la donnee source brute, potentiellement relue
  // ailleurs.
  const WEAPON_MASTERY_FIXED_COUNT: Record<string, number> = { paladin: 2, ranger: 2, rogue: 2 };
  const fixedWeaponMastery = sourceAttribution === "SRD 5.2.1" ? WEAPON_MASTERY_FIXED_COUNT[classIndex] : undefined;
  const ownLevels: SrdRecord[] =
    fixedWeaponMastery === undefined
      ? rawLevels
      : rawLevels.map((lvl) => ({
          ...lvl,
          class_specific: { ...((lvl.class_specific as SrdRecord | undefined) ?? {}), weapon_mastery: fixedWeaponMastery },
        }));

  const classSpecificKeys = new Set<string>();
  const spellcastingKeys = new Set<string>();
  for (const lvl of ownLevels) {
    for (const k of Object.keys((lvl.class_specific as SrdRecord | undefined) ?? {})) {
      classSpecificKeys.add(k);
    }
    for (const k of Object.keys((lvl.spellcasting as SrdRecord | undefined) ?? {})) {
      spellcastingKeys.add(k);
    }
  }

  const columns = [
    { key: "level", label: { fr: "Niveau", en: "Level" }, kind: "level" as const },
    { key: "prof_bonus", label: { fr: "Bonus de maitrise", en: "Proficiency bonus" }, kind: "value" as const },
    { key: "features", label: { fr: "Aptitudes", en: "Features" }, kind: "grants" as const },
    ...[...classSpecificKeys].map((k) => ({
      key: `class_specific_${k}`,
      label: { fr: CLASS_SPECIFIC_COLUMN_LABELS_FR[k] ?? k, en: k },
      kind: "value" as const,
    })),
    ...[...spellcastingKeys].map((k) => {
      const slotMatch = k.match(/^spell_slots_level_(\d)$/);
      const fr = slotMatch ? `Emplacements niv. ${slotMatch[1]}` : (SPELLCASTING_COLUMN_LABELS_FR[k] ?? k);
      return { key: `spellcasting_${k}`, label: { fr, en: k }, kind: "value" as const };
    }),
  ];

  const rows = ownLevels.map((lvl) => {
    const row: Record<string, unknown> = {
      level: lvl.level,
      prof_bonus: lvl.prof_bonus,
      features: Array.isArray(lvl.features)
        ? (lvl.features as SrdRecord[]).map((f) => {
            const key = String(f.index);
            return { feature: remapFeatureKey.get(key) ?? key };
          })
        : [],
    };
    const classSpecific = (lvl.class_specific as SrdRecord | undefined) ?? {};
    for (const k of classSpecificKeys) row[`class_specific_${k}`] = classSpecific[k];
    const spellcasting = (lvl.spellcasting as SrdRecord | undefined) ?? {};
    for (const k of spellcastingKeys) row[`spellcasting_${k}`] = spellcasting[k];
    return row;
  });

  const data = { max_level: 20, columns, rows };
  validateBlockData("class_progression", data);
  return {
    block_type: "class_progression",
    display: { label: "Progression", layout: "progression_table" },
    data,
    display_order: 200,
  };
}

// --------------------------------------------------------------------
// Blocs V1-D1 (weapon, armor, item_properties, stat_block, actions, traits,
// prerequisites, class_basics, spellcasting_progression, subclass_slot) —
// V1-D2 les alimente reellement depuis les donnees SRD. `charges` en est
// volontairement absent : le SRD ne porte cette information qu'en prose
// libre dans `desc` (ex. Cube of Force, "starts with 36 charges, and it
// regains 1d20 expended charges daily at dawn"), jamais en champ structure
// — un parseur regex serait fragile et donnerait de fausses valeurs
// silencieusement, pire qu'une absence honnete. Reste attachable a la main,
// entree par entree, comme prevu des V1-D1.
//
// Deux familles de retour : les blocs *requis* pour leur entry_type
// (weapon/armor/stat_block/actions/class_basics/subclass_slot) leve une
// exception quand la donnee source est reellement incoherente (ex. arme
// sans categorie simple/martiale identifiable) — ca fait echouer l'entree
// et remonte dans le rapport (« zero echec silencieux »). Les blocs
// optionnels (traits/prerequisites/spellcasting_progression, et les blocs
// requis quand l'absence est une propriete legitime de l'entree, ex. le
// Filet sans dgats ou la Grenouille sans action) renvoient simplement
// `null` : l'entree reste "incomplete" pour ce type de bloc, comportement
// attendu du registre REQUIRED_BLOCKS, pas une erreur.
// --------------------------------------------------------------------

function quantity(value: number, unit: string) {
  return { value, unit };
}

/** SRD 2014 : `weapon_category` ("Simple"/"Martial"). SRD 2024 : ce champ disparait, remplace par `equipment_categories`. */
function resolveWeaponCategory(entry: SrdRecord): "simple" | "martial" | null {
  const direct = String(entry.weapon_category ?? "");
  if (/simple/i.test(direct)) return "simple";
  if (/martial/i.test(direct)) return "martial";
  const categories = entry.equipment_categories;
  if (Array.isArray(categories)) {
    const names = (categories as SrdRecord[]).map((c) => String(c.name ?? ""));
    if (names.some((n) => /simple/i.test(n))) return "simple";
    if (names.some((n) => /martial/i.test(n))) return "martial";
  }
  return null;
}

/**
 * `null` si l'entree n'a pas de degats exploitables (ex. le Filet, arme au
 * sens du SRD mais sans `damage` — sa mecanique vit entierement dans sa
 * propriete `special`) : l'entree reste alors "incomplete", pas un echec.
 */
function weaponBlock(entry: SrdRecord): EntryBlock | null {
  const weapon = parseWeaponData(entry);
  if (!weapon) return null;

  const category = resolveWeaponCategory(entry);
  if (!category) {
    throw new Error(`weapon : categorie simple/martiale introuvable pour "${String(entry.name)}"`);
  }
  const damageDice = tryParseDiceFormula(weapon.damageDice);
  if (!damageDice) {
    throw new Error(`weapon : degats "${weapon.damageDice}" illisibles comme formule pour "${String(entry.name)}"`);
  }
  const versatileDamage = weapon.versatileDamageDice ? tryParseDiceFormula(weapon.versatileDamageDice) : undefined;

  // Le filet mis a part, `throw_range` (portee de lancer) prime sur `range`
  // (allonge au corps a corps) quand les deux existent : c'est le nombre
  // qu'un joueur utilise reellement pour attaquer avec une arme de jet.
  const throwRange = entry.throw_range as { normal?: number; long?: number } | undefined;
  const meleeOrShotRange = entry.range as { normal?: number; long?: number } | undefined;
  const rangeSource = typeof throwRange?.normal === "number" ? throwRange : meleeOrShotRange;
  const range =
    typeof rangeSource?.normal === "number"
      ? { normal: quantity(rangeSource.normal, "ft"), long: typeof rangeSource.long === "number" ? quantity(rangeSource.long, "ft") : undefined }
      : undefined;

  const cost = parseItemCost(entry);
  const weight = parseItemWeight(entry);

  // Botte d'arme (V1-D7, retour utilisateur) : mecanique 2024 uniquement,
  // absente du SRD 5.1 — `entry.mastery` y est simplement absent, `mastery`
  // reste `undefined` pour ces armes plutot qu'une erreur.
  const masteryRaw = entry.mastery as SrdRecord | undefined;
  const masteryIndex = typeof masteryRaw?.index === "string" ? masteryRaw.index : undefined;

  const data = {
    category,
    is_ranged: weapon.isRanged,
    damage: { dice: damageDice, type: weapon.damageType ?? undefined },
    versatile_damage: versatileDamage,
    properties: weapon.properties.map((p) => ({ kind: "rule" as const, key: `weapon-property-${p}` })),
    mastery: masteryIndex ? { kind: "rule" as const, key: `weapon-mastery-${masteryIndex}` } : undefined,
    range,
    weight: weight !== null ? quantity(weight, "lb") : undefined,
    cost: cost ? quantity(cost.quantity, cost.unit) : undefined,
  };
  validateBlockData("weapon", data);
  return { block_type: "weapon", display: { label: "Arme", layout: "key_values" }, data, display_order: 150 };
}

function armorBlock(entry: SrdRecord): EntryBlock | null {
  const armor = parseArmorData(entry);
  if (!armor) return null;

  const category = armor.category.toLowerCase();
  if (category !== "light" && category !== "medium" && category !== "heavy" && category !== "shield") {
    throw new Error(`armor : categorie inconnue "${armor.category}" pour "${String(entry.name)}"`);
  }

  const armorClass = entry.armor_class as { max_bonus?: number } | undefined;
  const strMinimum = typeof entry.str_minimum === "number" && entry.str_minimum > 0 ? entry.str_minimum : undefined;
  const cost = parseItemCost(entry);
  const weight = parseItemWeight(entry);

  const data = {
    category,
    base_ac: armor.base,
    dex_bonus: armor.dexBonus,
    max_dex_bonus: typeof armorClass?.max_bonus === "number" ? armorClass.max_bonus : undefined,
    strength_minimum: strMinimum,
    stealth_disadvantage: entry.stealth_disadvantage === true ? true : undefined,
    weight: weight !== null ? quantity(weight, "lb") : undefined,
    cost: cost ? quantity(cost.quantity, cost.unit) : undefined,
  };
  validateBlockData("armor", data);
  return { block_type: "armor", display: { label: "Armure", layout: "key_values" }, data, display_order: 150 };
}

/**
 * Degats/jet de sauvegarde de quelques objets (V1-D7, retour utilisateur
 * explicite : "acide... besoin de champ de degats... ou de jet de
 * sauvegarde"). Aucune des deux editions ne porte ces informations sous
 * forme structuree dans le JSON source (verifie : seul un paragraphe libre
 * existe, ex. `acid.description` en 2024) — extrait a la main du texte SRD
 * francais deja verifie lors de la passe de description, jamais devine.
 * Cle = `sourceAttribution` (edition) + `entry_key`, pour ne pas confondre
 * les valeurs entre 5.1 et 5.2.1 (ex. Poison standard a un jet de
 * sauvegarde en 5.1 mais pas en 5.2.1). `dc` reste une chaine plutot qu'un
 * FormulaNode : la plupart de ces DD dependent du lanceur ("8 + bonus de
 * maitrise + modificateur de Dexterite"), une formule relative au
 * personnage jamais serialisee nulle part ailleurs dans le projet — un
 * champ invente pour un seul ticket n'aurait rien resolu de plus qu'un
 * texte clair. Huile volontairement absente : ses degats sont
 * conditionnels a un embrasement ulterieur, pas une mecanique de jet direct.
 */
const WIELDER_DC = "8 + bonus de maitrise + modificateur de Dexterite";
const ITEM_DAMAGE_SAVE: Record<string, Record<string, { damage?: { formula: FormulaNode; damage_type?: string }; save?: { ability: string; dc: string; effect_on_success?: string } }>> = {
  "SRD 5.2.1": {
    acid: { damage: { formula: { op: "dice", count: 2, faces: 6 }, damage_type: "Acid" }, save: { ability: "dex", dc: WIELDER_DC, effect_on_success: "Aucun degat" } },
    "alchemists-fire": { damage: { formula: { op: "dice", count: 1, faces: 4 }, damage_type: "Fire" }, save: { ability: "dex", dc: WIELDER_DC, effect_on_success: "Aucun degat, ne prend pas feu" } },
    "holy-water": { damage: { formula: { op: "dice", count: 2, faces: 8 }, damage_type: "Radiant" }, save: { ability: "dex", dc: WIELDER_DC, effect_on_success: "Aucun degat" } },
    "poison-basic": { damage: { formula: { op: "dice", count: 1, faces: 4 }, damage_type: "Poison" } },
    caltrops: { damage: { formula: { op: "num", value: 1 }, damage_type: "Piercing" }, save: { ability: "dex", dc: "15", effect_on_success: "Aucun effet" } },
    "hunting-trap": { damage: { formula: { op: "dice", count: 1, faces: 4 }, damage_type: "Piercing" }, save: { ability: "dex", dc: "13", effect_on_success: "Aucun effet" } },
    "ball-bearings": { save: { ability: "dex", dc: "10", effect_on_success: "Ne tombe pas a terre" } },
  },
  "SRD 5.1": {
    "acid-vial": { damage: { formula: { op: "dice", count: 2, faces: 6 }, damage_type: "Acid" } },
    "alchemists-fire-flask": { damage: { formula: { op: "dice", count: 1, faces: 4 }, damage_type: "Fire" } },
    "holy-water-flask": { damage: { formula: { op: "dice", count: 2, faces: 6 }, damage_type: "Radiant" } },
    "poison-basic-vial": { damage: { formula: { op: "dice", count: 1, faces: 4 }, damage_type: "Poison" }, save: { ability: "con", dc: "10", effect_on_success: "Aucun degat" } },
    caltrops: { damage: { formula: { op: "num", value: 1 }, damage_type: "Piercing" }, save: { ability: "dex", dc: "15", effect_on_success: "Aucun effet" } },
    "hunting-trap": { damage: { formula: { op: "dice", count: 1, faces: 4 }, damage_type: "Piercing" }, save: { ability: "dex", dc: "13", effect_on_success: "Aucun effet" } },
    "ball-bearings-bag-of-1000": { save: { ability: "dex", dc: "10", effect_on_success: "Ne tombe pas a terre" } },
  },
};

/**
 * Tous les champs du schema sont optionnels (V1-D1) : `null` seulement si
 * aucun n'a pu etre rempli, pour eviter un bloc "present" mais vide de sens
 * (qui masquerait a tort le signal "regle incomplete").
 */
function itemPropertiesBlock(entry: SrdRecord, sourceAttribution: string): EntryBlock | null {
  const cost = parseItemCost(entry);
  const weight = parseItemWeight(entry);
  const rarityRaw = entry.rarity as SrdRecord | undefined;
  const rarity = typeof rarityRaw?.name === "string" ? rarityRaw.name : undefined;

  const descArr = Array.isArray(entry.desc) ? (entry.desc as unknown[]) : typeof entry.desc === "string" ? [entry.desc] : [];
  const firstLine = typeof descArr[0] === "string" ? (descArr[0] as string) : "";
  const requiresAttunement = /requires attunement/i.test(firstLine) ? true : undefined;

  const gearCategory = entry.gear_category as SrdRecord | undefined;
  const equipmentCategory = entry.equipment_category as SrdRecord | undefined;
  const category =
    (typeof gearCategory?.name === "string" ? gearCategory.name : undefined) ??
    (typeof equipmentCategory?.name === "string" ? equipmentCategory.name : undefined);

  // Champs ajoutes en V1-D7 (bloc unique pour item/magic_item/mount, retour
  // utilisateur) : `limited-to` (23 objets sur 262, ex. "Nain ou creature en
  // Harmonie avec une Ceinture de force naine"), `capacity` (uniquement les
  // montures, texte SRD deja mis en forme, ex. "450 lb.", jamais reparse),
  // `contents` (paquetages d'aventurier — chaque objet inclus EST une
  // reference, meme motif que `background.equipment_options[].items`).
  const attunementRestriction = typeof entry["limited-to"] === "string" ? (entry["limited-to"] as string) : undefined;
  const capacity = typeof entry.capacity === "string" ? (entry.capacity as string) : undefined;
  const rawContents = Array.isArray(entry.contents) ? (entry.contents as SrdRecord[]) : [];
  const contents = rawContents
    .map((c) => {
      const item = c.item as SrdRecord | undefined;
      const index = item?.index;
      const name = item?.name;
      if (typeof index !== "string" || typeof name !== "string" || typeof c.quantity !== "number") return null;
      return { ref: { kind: "rule" as const, key: index }, label: name, quantity: c.quantity };
    })
    .filter((c): c is { ref: { kind: "rule"; key: string }; label: string; quantity: number } => c !== null);

  const damageSave = typeof entry.index === "string" ? ITEM_DAMAGE_SAVE[sourceAttribution]?.[entry.index] : undefined;

  const data = {
    weight: weight !== null ? quantity(weight, "lb") : undefined,
    cost: cost ? quantity(cost.quantity, cost.unit) : undefined,
    rarity,
    requires_attunement: requiresAttunement,
    attunement_restriction: attunementRestriction,
    category,
    capacity,
    contents: contents.length > 0 ? contents : undefined,
    damage: damageSave?.damage,
    save: damageSave?.save,
  };
  if (
    !data.weight &&
    !data.cost &&
    !data.rarity &&
    !data.requires_attunement &&
    !data.attunement_restriction &&
    !data.category &&
    !data.capacity &&
    !data.contents &&
    !data.damage &&
    !data.save
  )
    return null;

  validateBlockData("item_properties", data);
  return { block_type: "item_properties", display: { label: "Proprietes", layout: "key_values" }, data, display_order: 150 };
}

/** Chaine ou reference {index,name} -> libelle exploitable ; `null` si aucun des deux. */
function stringOrNameList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = (raw as unknown[])
    .map((v) => {
      if (typeof v === "string") return v;
      const named = v as SrdRecord;
      return typeof named?.name === "string" ? named.name : null;
    })
    .filter((v): v is string => typeof v === "string");
  return out.length > 0 ? out : undefined;
}

/** `null` si un des faits obligatoires du schema est absent — n'arrive jamais sur le SRD reel (verifie : 334/334 monstres 2014, 3/3 2024), un declencheur serait un vrai probleme de donnee. */
function statBlockBlock(entry: SrdRecord): EntryBlock | null {
  const acEntries = entry.armor_class as SrdRecord[] | undefined;
  const ac = Array.isArray(acEntries) && typeof acEntries[0]?.value === "number" ? (acEntries[0].value as number) : undefined;
  if (ac === undefined) throw new Error(`stat_block : CA introuvable pour "${String(entry.name)}"`);
  if (typeof entry.hit_points !== "number") throw new Error(`stat_block : PV introuvables pour "${String(entry.name)}"`);
  if (typeof entry.hit_dice !== "string") throw new Error(`stat_block : de de vie introuvable pour "${String(entry.name)}"`);

  const abilityFields = { str: entry.strength, dex: entry.dexterity, con: entry.constitution, int: entry.intelligence, wis: entry.wisdom, cha: entry.charisma };
  for (const [key, value] of Object.entries(abilityFields)) {
    if (typeof value !== "number") throw new Error(`stat_block : caracteristique ${key} introuvable pour "${String(entry.name)}"`);
  }

  const speedRaw = entry.speed as SrdRecord | undefined;
  const speed: Record<string, string> = {};
  if (speedRaw && typeof speedRaw === "object") {
    for (const [k, v] of Object.entries(speedRaw)) if (typeof v === "string") speed[k] = v;
  }

  const sensesRaw = entry.senses as SrdRecord | undefined;
  const senses: Record<string, string> = {};
  if (sensesRaw && typeof sensesRaw === "object") {
    for (const [k, v] of Object.entries(sensesRaw)) senses[k] = String(v);
  }

  // `proficiencies` d'un monstre porte le bonus deja total (ex. {value: 6,
  // proficiency: {index: "skill-stealth"}}), pas un modificateur brut a
  // combiner plus tard — forme differente de `proficiencies` sur une classe.
  const savingThrows: { ability: string; bonus: number }[] = [];
  const skills: { name: string; bonus: number }[] = [];
  const profRaw = entry.proficiencies;
  if (Array.isArray(profRaw)) {
    for (const p of profRaw as SrdRecord[]) {
      const prof = p.proficiency as SrdRecord | undefined;
      const idx = typeof prof?.index === "string" ? prof.index : undefined;
      const bonus = typeof p.value === "number" ? p.value : undefined;
      if (!idx || bonus === undefined) continue;
      if (idx.startsWith("saving-throw-")) savingThrows.push({ ability: idx.replace("saving-throw-", ""), bonus });
      else if (idx.startsWith("skill-")) skills.push({ name: typeof prof?.name === "string" ? prof.name : idx, bonus });
    }
  }

  const data = {
    size: String(entry.size ?? ""),
    creature_type: String(entry.type ?? ""),
    alignment: typeof entry.alignment === "string" ? entry.alignment : undefined,
    armor_class: ac,
    hit_points: entry.hit_points,
    hit_dice: entry.hit_dice,
    speed,
    abilities: abilityFields as Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>,
    saving_throws: savingThrows.length > 0 ? savingThrows : undefined,
    skills: skills.length > 0 ? skills : undefined,
    damage_vulnerabilities: stringOrNameList(entry.damage_vulnerabilities),
    damage_resistances: stringOrNameList(entry.damage_resistances),
    damage_immunities: stringOrNameList(entry.damage_immunities),
    condition_immunities: stringOrNameList(entry.condition_immunities),
    senses: Object.keys(senses).length > 0 ? senses : undefined,
    languages: typeof entry.languages === "string" ? entry.languages : undefined,
    challenge_rating: typeof entry.challenge_rating === "number" ? entry.challenge_rating : 0,
    proficiency_bonus: typeof entry.proficiency_bonus === "number" ? entry.proficiency_bonus : 2,
  };
  validateBlockData("stat_block", data);
  return { block_type: "stat_block", display: { label: "Caracteristiques", layout: "key_values" }, data, display_order: 150 };
}

/** `null` sans action listee (4 monstres du SRD 2014 : Grenouille, Hippocampe, Choqueur, Brume de vampire) — l'entree reste "incomplete", fidele a la donnee source. */
function actionsBlock(entry: SrdRecord): EntryBlock | null {
  const raw = entry.actions;
  if (!Array.isArray(raw)) return null;
  const actions = (raw as SrdRecord[])
    .map((a) => {
      const name = String(a.name ?? "");
      const description = extractProse(a) ?? "";
      if (!name || !description) return null;
      const damageRaw = Array.isArray(a.damage) ? (a.damage as SrdRecord[]) : [];
      const damage = damageRaw
        .map((d) => {
          const dice = typeof d.damage_dice === "string" ? tryParseDiceFormula(d.damage_dice) : undefined;
          if (!dice) return null;
          const damageType = d.damage_type as SrdRecord | undefined;
          const type = typeof damageType?.name === "string" ? damageType.name : undefined;
          return { dice, type };
        })
        .filter((d): d is { dice: FormulaNode; type: string | undefined } => d !== null);
      return {
        name,
        description,
        attack_bonus: typeof a.attack_bonus === "number" ? a.attack_bonus : undefined,
        damage: damage.length > 0 ? damage : undefined,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
  if (actions.length === 0) return null;

  const data = { actions };
  validateBlockData("actions", data);
  return { block_type: "actions", display: { label: "Actions", layout: "key_values" }, data, display_order: 350 };
}

/**
 * `null` sans action legendaire listee (la grande majorite des monstres) —
 * jamais requis, voir REQUIRED_BLOCKS. Meme forme et meme logique que
 * `actionsBlock` (V1-E4b, retour utilisateur : "il manque les actions
 * legendaires") : le SRD porte les memes champs `attack_bonus`/`damage` sur
 * `entry.legendary_actions` que sur `entry.actions` (verifie sur Aboleth,
 * "Psychic Drain" a un `damage` sans `attack_bonus`).
 */
function legendaryActionsBlock(entry: SrdRecord): EntryBlock | null {
  const raw = entry.legendary_actions;
  if (!Array.isArray(raw)) return null;
  const actions = (raw as SrdRecord[])
    .map((a) => {
      const name = String(a.name ?? "");
      const description = extractProse(a) ?? "";
      if (!name || !description) return null;
      const damageRaw = Array.isArray(a.damage) ? (a.damage as SrdRecord[]) : [];
      const damage = damageRaw
        .map((d) => {
          const dice = typeof d.damage_dice === "string" ? tryParseDiceFormula(d.damage_dice) : undefined;
          if (!dice) return null;
          const damageType = d.damage_type as SrdRecord | undefined;
          const type = typeof damageType?.name === "string" ? damageType.name : undefined;
          return { dice, type };
        })
        .filter((d): d is { dice: FormulaNode; type: string | undefined } => d !== null);
      return {
        name,
        description,
        attack_bonus: typeof a.attack_bonus === "number" ? a.attack_bonus : undefined,
        damage: damage.length > 0 ? damage : undefined,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
  if (actions.length === 0) return null;

  const data = { actions };
  validateBlockData("legendary_actions", data);
  return { block_type: "legendary_actions", display: { label: "Actions legendaires", layout: "key_values" }, data, display_order: 360 };
}

/** `null` sans aptitude speciale listee (beaucoup de creatures de faible FP n'en ont aucune) — jamais requis, voir REQUIRED_BLOCKS. */
function traitsBlock(entry: SrdRecord): EntryBlock | null {
  const raw = entry.special_abilities;
  if (!Array.isArray(raw)) return null;
  const traits = (raw as SrdRecord[])
    .map((t) => ({ name: String(t.name ?? ""), description: extractProse(t) ?? "" }))
    .filter((t) => t.name && t.description);
  if (traits.length === 0) return null;

  const data = { traits };
  validateBlockData("traits", data);
  return { block_type: "traits", display: { label: "Aptitudes speciales", layout: "key_values" }, data, display_order: 340 };
}

/**
 * Decoupe `entry.description` (Condition, prose libre "While you have the
 * X condition, you experience the following effect(s).\n**Titre.**
 * texte...") en effets nommes (V1-D7, sur retour utilisateur explicite :
 * "il n'y a pas de bloc de description, mais ca reste des blocs de
 * conditions... il faut creer un bloc de conditions"). La phrase d'intro
 * (premiere ligne) est ecartee : pur remplissage, deja implicite par le
 * titre de la fiche elle-meme. Le bloc `description` (repli generique,
 * `transformEntry`) reste present a cote de celui-ci — pas pour la prose
 * SRD (redondante avec les effets ci-dessous), mais comme support du lore
 * invente ecrit a la main (meme motif qu'Historique/background, sur
 * nouveau retour utilisateur : une phrase courte, parfois amusante, avant
 * le bloc mecanique). `null` si aucune ligne ne correspond au motif
 * "**Titre.** texte" (fiche source inattendue, jamais silencieusement vide).
 */
function conditionEffectsBlock(entry: SrdRecord): EntryBlock | null {
  const prose = extractProse(entry);
  if (!prose) return null;

  const effects = prose
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.match(/^\*\*([^*]+?)\.?\*\*\s*([\s\S]*)$/);
      if (!match) return null;
      return { name: match[1], description: match[2] };
    })
    .filter((e): e is { name: string; description: string } => e !== null && e.name !== "" && e.description !== "");
  if (effects.length === 0) return null;

  const data = { effects };
  validateBlockData("condition_effects", data);
  return { block_type: "condition_effects", display: { label: "Effets", layout: "key_values" }, data, display_order: 150 };
}

/** Abreviation FR d'une caracteristique (meme vocabulaire que ABILITY_ABBR_FR dans blockContentRenderer.tsx, duplique ici : concern de generation de texte a l'import, pas d'affichage). */
const ABILITY_ABBR_FR: Record<string, string> = { str: "FOR", dex: "DEX", con: "CON", int: "INT", wis: "SAG", cha: "CHA" };

/**
 * `null` sans prerequis (l'immense majorite des dons) — jamais requis. Deux
 * formes rencontrees dans le SRD : 2014 (`[{ability_score, minimum_score}]`)
 * et 2024 (`{minimum_level?, feature_named?}`, objet unique, pas un tableau).
 *
 * Texte engendre directement en francais (V1-D3) : contrairement aux autres
 * blocs, ce texte n'est pas de la prose SRD extraite d'un PDF a verifier
 * mot pour mot — c'est un gabarit ecrit par ce script a partir de faits
 * structures (score minimum, niveau), donc le generer en francais des
 * l'import est correct et ne demande aucune ligne de
 * `ruleset_entry_translations`. `feature_named` (2024, ex. "Fighting
 * Style") reste en anglais : c'est le nom d'une autre aptitude, pas un mot
 * de vocabulaire ferme.
 */
function prerequisitesBlock(entry: SrdRecord): EntryBlock | null {
  const raw = entry.prerequisites;
  if (!raw) return null;
  const items: string[] = [];

  if (Array.isArray(raw)) {
    for (const p of raw as SrdRecord[]) {
      const ability = p.ability_score as SrdRecord | undefined;
      const abbr = typeof ability?.index === "string" ? ABILITY_ABBR_FR[ability.index] : undefined;
      if (abbr && typeof p.minimum_score === "number") {
        items.push(`${abbr} ${p.minimum_score} ou plus`);
      }
    }
  } else if (typeof raw === "object") {
    const p = raw as SrdRecord;
    if (typeof p.minimum_level === "number") items.push(`Niveau ${p.minimum_level} ou plus`);
    if (typeof p.feature_named === "string") items.push(p.feature_named);
  }
  if (items.length === 0) return null;

  const data = { items };
  validateBlockData("prerequisites", data);
  return { block_type: "prerequisites", display: { label: "Prerequis", layout: "chips" }, data, display_order: 120 };
}

/** armure/arme -> `armor_proficiencies`/`weapon_proficiencies`, outil -> `tool_proficiencies` ; verifie sur les 12 classes de base, 2014 et 2024. */
function classifyProficiencyIndex(index: string): "armor" | "tool" | "weapon" {
  if (/armor$/.test(index) || index === "shields") return "armor";
  if (/-kit$/.test(index) || /-tools$/.test(index) || /^tool-/.test(index)) return "tool";
  return "weapon";
}

/** `class_basics` n'echoue jamais : `mapClassCore` retombe sur un de de vie par defaut, les listes de maitrises restent vides plutot que d'empecher l'import. */
function classBasicsBlock(entry: SrdRecord): EntryBlock {
  const core = mapClassCore(entry);

  const armorProf: string[] = [];
  const weaponProf: string[] = [];
  const toolProf: string[] = [];
  const profRaw = entry.proficiencies;
  if (Array.isArray(profRaw)) {
    for (const p of profRaw as SrdRecord[]) {
      const index = p.index;
      if (typeof index !== "string" || index.startsWith("saving-throw-") || index.startsWith("skill-")) continue;
      const name = typeof p.name === "string" ? p.name : index;
      const kind = classifyProficiencyIndex(index);
      if (kind === "armor") armorProf.push(name);
      else if (kind === "tool") toolProf.push(name);
      else weaponProf.push(name);
    }
  }

  const data = {
    hit_die: core.hitDie,
    saving_throw_proficiencies: core.savingThrowProficiencies,
    armor_proficiencies: armorProf.length > 0 ? armorProf : undefined,
    weapon_proficiencies: weaponProf.length > 0 ? weaponProf : undefined,
    tool_proficiencies: toolProf.length > 0 ? toolProf : undefined,
  };
  validateBlockData("class_basics", data);
  return { block_type: "class_basics", display: { label: "Bases de classe", layout: "key_values" }, data, display_order: 150 };
}

/** `null` pour une classe qui n'incante pas (Barbare, Guerrier de base SRD) — jamais requis, voir REQUIRED_BLOCKS. */
function spellcastingProgressionBlock(entry: SrdRecord): EntryBlock | null {
  const spellcasting = entry.spellcasting as SrdRecord | undefined;
  const ability = (spellcasting?.spellcasting_ability as SrdRecord | undefined)?.index;
  if (typeof ability !== "string") return null;

  const infoRaw = Array.isArray(spellcasting?.info) ? (spellcasting!.info as SrdRecord[]) : [];
  const info = infoRaw
    .map((i) => ({ name: String(i.name ?? ""), description: extractProse(i) ?? "" }))
    .filter((i) => i.name && i.description);
  if (info.length === 0) return null;

  const data = {
    ability,
    starts_at_level: typeof spellcasting?.level === "number" ? spellcasting.level : 1,
    info,
  };
  validateBlockData("spellcasting_progression", data);
  return { block_type: "spellcasting_progression", display: { label: "Incantation", layout: "key_values" }, data, display_order: 250 };
}

/**
 * A quel niveau une classe choisit sa sous-classe, et sous quel nom. Aucun
 * champ direct ne le donne dans le SRD ; deux heuristiques generiques,
 * verifiees contre les 12 classes de base des deux editions avant d'ecrire
 * ce code (voir le detail dans docs/BACKLOG_V1.md, V1-D2) :
 *  - 2014 porte `subclass_flavor` sur la sous-classe elle-meme (ex. "Arcane
 *    Tradition") ; le niveau est celui de la premiere aptitude de classe
 *    dont le nom correspond exactement (insensible a la casse).
 *  - 2024 n'a plus `subclass_flavor` ; la sous-classe se choisit toujours a
 *    l'aptitude dont le nom ou la cle contient "subclass" (ex. "Wizard
 *    Subclass"), et le libelle affiche reprend le nom de cette aptitude.
 */
function subclassSlotBlock(classIndex: string, subclasses: SrdRecord[], levels: SrdRecord[]): EntryBlock {
  const ownSubclasses = subclasses.filter((s) => (s.class as SrdRecord | undefined)?.index === classIndex);
  if (ownSubclasses.length === 0) {
    throw new Error(`subclass_slot : aucune sous-classe trouvee pour "${classIndex}"`);
  }
  const flavor = ownSubclasses.map((s) => s.subclass_flavor).find((f): f is string => typeof f === "string");

  const ownLevels = levels
    .filter((l) => (l.class as SrdRecord | undefined)?.index === classIndex)
    .sort((a, b) => Number(a.level) - Number(b.level));

  let chosenAtLevel: number | undefined;
  let matchedFeatureName: string | undefined;
  for (const lvl of ownLevels) {
    const features = Array.isArray(lvl.features) ? (lvl.features as SrdRecord[]) : [];
    const match = features.find((f) => {
      const name = String(f.name ?? "");
      if (flavor) return name.toLowerCase() === flavor.toLowerCase();
      return /subclass/i.test(name) || /subclass/i.test(String(f.index ?? ""));
    });
    if (match) {
      chosenAtLevel = Number(lvl.level);
      matchedFeatureName = String(match.name ?? "");
      break;
    }
  }
  if (chosenAtLevel === undefined) {
    throw new Error(`subclass_slot : niveau de choix introuvable pour "${classIndex}" (aptitude "${flavor ?? "?"}" jamais rencontree)`);
  }

  const options = ownSubclasses
    .map((s) => (typeof s.index === "string" ? { kind: "entry" as const, key: s.index } : null))
    .filter((r): r is { kind: "entry"; key: string } => r !== null);

  const data = { label: flavor ?? matchedFeatureName ?? "Sous-classe", chosen_at_level: chosenAtLevel, options };
  validateBlockData("subclass_slot", data);
  return { block_type: "subclass_slot", display: { label: "Sous-classe", layout: "key_values" }, data, display_order: 250 };
}

/**
 * `entry.features` (Sous-classe, deja `[{name, level, description}]` dans
 * le SRD — contrairement aux monstres/conditions, aucun decoupage de prose
 * libre n'est necessaire ici). `null` si absent (fiche source inattendue,
 * jamais silencieusement vide — toutes les sous-classes du SRD en ont).
 */
function subclassFeaturesBlock(entry: SrdRecord): EntryBlock | null {
  const raw = entry.features;
  if (!Array.isArray(raw)) return null;
  const features = (raw as SrdRecord[])
    .map((f) => ({ name: String(f.name ?? ""), level: Number(f.level), description: extractProse(f) ?? "" }))
    .filter((f) => f.name && f.description && Number.isInteger(f.level) && f.level > 0);
  if (features.length === 0) return null;

  const data = { features };
  validateBlockData("subclass_features", data);
  return { block_type: "subclass_features", display: { label: "Sous-classe", layout: "progression_table" }, data, display_order: 150 };
}

/**
 * Traits d'une espece ou d'une sous-espece (V1-D7, retour utilisateur sur
 * la nidification sous-espece/espece dans la sidebar). `entry.traits`
 * porte deja des references (`{index, name}`) vers des fiches `feature`
 * existantes (categorie SRD "Traits") — jamais de nom+texte duplique ici.
 * `speciesAndSubspeciesKeys` predit le suffixe "-feature" qu'une aptitude
 * en collision avec sa propre entree espece/sous-espece recevra plus loin
 * dans l'import (ex. "giant-ancestry-clouds-jaunt", Goliath) — deterministe,
 * jamais devine (voir le calcul de l'ensemble, plus haut dans ce fichier).
 * `creature_type`/`size`/`speed` absents pour une sous-espece (elle n'en a
 * pas en propre) : `null` renvoye seulement si meme `traits` est vide,
 * jamais a cause des trois autres champs.
 */
function speciesTraitsBlock(entry: SrdRecord, speciesAndSubspeciesKeys: Set<string>): EntryBlock | null {
  const rawTraits = Array.isArray(entry.traits) ? (entry.traits as SrdRecord[]) : [];
  const traits = rawTraits
    .map((t) => {
      const index = t.index;
      if (typeof index !== "string") return null;
      const key = speciesAndSubspeciesKeys.has(index) ? `${index}-feature` : index;
      return { kind: "rule" as const, key };
    })
    .filter((r): r is { kind: "rule"; key: string } => r !== null);
  if (traits.length === 0) return null;

  // `sizes` (V1-D7, retour utilisateur) : repli minimal depuis le JSON
  // anglais source, verifie incomplet pour au moins une espece (Humain n'y
  // porte que "Medium", sans son second choix "Small" pourtant present dans
  // le texte officiel francais) — la vraie donnee (fourchette de taille par
  // categorie) vient exclusivement de la surcharge de traduction francaise,
  // jamais de ce repli. Un seul element ici, sans fourchette.
  const sizes = typeof entry.size === "string" ? [{ label: entry.size }] : undefined;

  const data = {
    creature_type: typeof entry.type === "string" ? entry.type.toLowerCase() : undefined,
    sizes,
    speed: typeof entry.speed === "number" ? quantity(entry.speed, "ft") : undefined,
    traits,
  };
  validateBlockData("species_traits", data);
  return { block_type: "species_traits", display: { label: "Traits", layout: "key_values" }, data, display_order: 150 };
}

/**
 * Categorie d'equipement (SRD `equipment_categories`, ex. "Gaming Sets") ->
 * libelle FR — rencontree seulement pour le choix d'outil du Soldat
 * (V1-D7), pas de table plus large (`Equipment-Categories` n'est pas une
 * categorie importee a part, meme motif que `WEAPON_PROPERTY_LABELS_FR`).
 * Etendre au besoin plutot qu'a l'avance (regle des trois).
 */
const EQUIPMENT_CATEGORY_LABELS_FR: Record<string, string> = {
  "Gaming Sets": "boîte de jeux",
  "Holy Symbols": "symbole sacré",
};

/**
 * `equipment_options[].from.options` (SRD 2024, V1-D7) -> options
 * structurees du bloc `background`. Chaque option est soit `option_type:
 * "multiple"` (une liste d'objets/monnaie), soit directement `"money"`
 * (option B pure, dans les 4 historiques actuels). Chaque objet devient une
 * reference `{kind:"rule", key: index}` : verifie sur les 4 historiques,
 * ces index (dague, outils de voleur, bourse...) correspondent tous a une
 * vraie fiche Objet/Arme deja importee, sans prefixe de desambiguisation
 * (contrairement aux proprietes d'arme). Deux cas sans reference precise,
 * memes libelles (EQUIPMENT_CATEGORY_LABELS_FR) : `option_type: "choice"`
 * (Soldat, "choisissez un type de boite de jeux") ET un `counted_reference`
 * dont `of.url` pointe vers `/equipment-categories/` plutot que
 * `/equipment/` (Acolyte, "Holy Symbols" — une categorie SRD, jamais
 * importee comme fiche a part, malgre la forme `counted_reference`
 * identique aux vrais objets ; distinguee par l'URL, pas par
 * `option_type`, decouvert en verifiant le rendu reel).
 */
/**
 * Coeur partage par `parseBackgroundEquipmentOptions` (un seul choix "A ou
 * B" par historique) et `parseClassEquipmentChoices` (V2-G1, plusieurs choix
 * INDEPENDANTS par classe, ex. Magicien 2014 : "baton de combat OU dague",
 * PUIS separement "besace a composants OU focaliseur") — meme forme SRD
 * (`from.options`) dans les deux cas, jamais deux lectures distinctes du
 * meme JSON.
 */
function parseEquipmentOptionsFromArray(optionsRaw: SrdRecord[]): BackgroundEquipmentOption[] {
  const letters = ["A", "B", "C", "D"];
  return optionsRaw.map((opt, i) => {
    const rawItems = opt.option_type === "multiple" ? (opt.items as SrdRecord[]) : [opt];
    const items: BackgroundEquipmentOption["items"] = [];
    let gold: BackgroundEquipmentOption["gold"];

    for (const raw of rawItems) {
      if (raw.option_type === "money") {
        gold = { value: Number(raw.count), unit: String(raw.unit) };
      } else if (raw.option_type === "counted_reference") {
        const of = raw.of as SrdRecord;
        const url = typeof of?.url === "string" ? of.url : "";
        if (typeof of?.index === "string" && url.includes("/equipment-categories/")) {
          const name = typeof of.name === "string" ? of.name : of.index;
          items.push({ label: `${EQUIPMENT_CATEGORY_LABELS_FR[name] ?? name} (au choix)`, quantity: Number(raw.count ?? 1) });
        } else if (typeof of?.index === "string") {
          items.push({ ref: { kind: "rule", key: of.index }, label: String(of.name ?? of.index), quantity: Number(raw.count ?? 1) });
        }
      } else if (raw.option_type === "choice") {
        const categoryName = ((raw.choice as SrdRecord | undefined)?.from as SrdRecord | undefined)?.equipment_category as
          | SrdRecord
          | undefined;
        const name = typeof categoryName?.name === "string" ? categoryName.name : undefined;
        const label = name ? `${EQUIPMENT_CATEGORY_LABELS_FR[name] ?? name} (au choix)` : "Choix libre";
        items.push({ label, quantity: 1 });
      }
    }

    return { label: letters[i] ?? String(i + 1), items, gold };
  });
}

function parseBackgroundEquipmentOptions(entry: SrdRecord): BackgroundEquipmentOption[] {
  const optionsRaw = ((entry.equipment_options as SrdRecord[] | undefined)?.[0]?.from as SrdRecord | undefined)
    ?.options as SrdRecord[] | undefined;
  if (!Array.isArray(optionsRaw)) return [];
  return parseEquipmentOptionsFromArray(optionsRaw);
}

/**
 * Equipement de depart d'une classe (V2-G1, retour utilisateur point 9) —
 * `starting_equipment` (objets TOUJOURS accordes, jamais un choix) et
 * `starting_equipment_options` (N choix INDEPENDANTS, chacun sous la meme
 * forme `from.options` qu'un historique) verifies identiques en structure
 * entre 2014 et 2024 sur les classes du SRD deja importees.
 */
function parseClassFixedEquipment(entry: SrdRecord): BackgroundEquipmentOption["items"] {
  const raw = entry.starting_equipment;
  if (!Array.isArray(raw)) return [];
  const items: BackgroundEquipmentOption["items"] = [];
  for (const row of raw as SrdRecord[]) {
    const equipment = row.equipment as SrdRecord | undefined;
    if (typeof equipment?.index !== "string") continue;
    items.push({
      ref: { kind: "rule", key: equipment.index },
      label: String(equipment.name ?? equipment.index),
      quantity: Number(row.quantity ?? 1),
    });
  }
  return items;
}

function parseClassEquipmentChoices(entry: SrdRecord): { options: BackgroundEquipmentOption[] }[] {
  const raw = entry.starting_equipment_options;
  if (!Array.isArray(raw)) return [];
  const choices: { options: BackgroundEquipmentOption[] }[] = [];
  for (const choice of raw as SrdRecord[]) {
    const optionsRaw = (choice.from as SrdRecord | undefined)?.options as SrdRecord[] | undefined;
    if (!Array.isArray(optionsRaw)) continue;
    const options = parseEquipmentOptionsFromArray(optionsRaw);
    if (options.length > 0) choices.push({ options });
  }
  return choices;
}

/**
 * Bloc `class_equipment` (V2-G1) — `null` seulement si la classe n'a NI
 * objet fixe NI choix (jamais rencontre sur les classes reellement
 * importees, mais une classe maison pourrait ne pas encore avoir cette
 * donnee) : un bloc vide n'aurait rien a montrer, ne pas le poser plutot
 * que poser un bloc sans contenu.
 */
function classEquipmentBlock(entry: SrdRecord): EntryBlock | null {
  const fixed = parseClassFixedEquipment(entry);
  const choices = parseClassEquipmentChoices(entry);
  if (fixed.length === 0 && choices.length === 0) return null;

  const data = { fixed, choices };
  validateBlockData("class_equipment", data);
  return { block_type: "class_equipment", display: { label: "Équipement de départ", layout: "key_values" }, data, display_order: 160 };
}

/**
 * `null` quand la forme source n'est pas celle du SRD 2024 (`ability_scores`
 * + `feat` structures) — le SRD 2014 des historiques (une seule entree,
 * "acolyte", toujours ecrasee par la version 2024 de meme index avant que
 * cette fonction ne s'execute) n'a jamais cette forme. Les 4 historiques
 * reellement en base passent tous par la branche remplie ; `null` reste la
 * pour une entree maison qui n'aurait pas encore cette structure, jamais
 * une exception qui ferait echouer tout l'import.
 *
 * `skill_proficiencies` normalise vers les cles `Skill` (src/core/rules/sheet.ts,
 * "skill-sleight-of-hand" -> "sleight_of_hand") plutot que le nom anglais
 * brut : blockContentRenderer.tsx peut alors reutiliser SKILL_LABELS_FR
 * (deja complet, 18 competences) sans nouvelle table de correspondance.
 * `tool_proficiency` garde au contraire le nom anglais affichable (comme
 * `class_basics.tool_proficiencies`) : reutilise CLASS_PROFICIENCY_LABELS_FR,
 * complete au besoin plutot que duplique. Le choix d'outil libre (ex.
 * Soldat, "choisissez un type de boite de jeux") vient de
 * `proficiency_choices[0].desc` quand aucune maitrise fixe n'existe.
 */
function backgroundBlock(entry: SrdRecord): EntryBlock | null {
  const abilityScoresRaw = entry.ability_scores;
  const featRaw = entry.feat as SrdRecord | undefined;
  if (!Array.isArray(abilityScoresRaw) || typeof featRaw?.index !== "string") return null;

  const abilityScores = (abilityScoresRaw as SrdRecord[])
    .map((a) => (typeof a.index === "string" ? a.index : null))
    .filter((a): a is string => a !== null);
  if (abilityScores.length !== 3) return null;

  const profRaw = Array.isArray(entry.proficiencies) ? (entry.proficiencies as SrdRecord[]) : [];
  const skillProficiencies = profRaw
    .filter((p) => typeof p.index === "string" && p.index.startsWith("skill-"))
    .map((p) => (p.index as string).replace(/^skill-/, "").replace(/-/g, "_"));
  const fixedTool = profRaw.find((p) => typeof p.index === "string" && p.index.startsWith("tool-"));
  const choiceRaw = Array.isArray(entry.proficiency_choices)
    ? (entry.proficiency_choices[0] as SrdRecord | undefined)
    : undefined;
  const fixedToolName = typeof fixedTool?.name === "string" ? fixedTool.name.replace(/^Tool: /, "") : undefined;
  const toolProficiency = fixedToolName ?? (typeof choiceRaw?.desc === "string" ? choiceRaw.desc : undefined);

  const data = {
    ability_scores: abilityScores,
    feat: { kind: "rule" as const, key: featRaw.index },
    skill_proficiencies: skillProficiencies,
    tool_proficiency: toolProficiency,
    equipment_options: parseBackgroundEquipmentOptions(entry),
  };
  validateBlockData("background", data);
  return { block_type: "background", display: { label: "Historique", layout: "key_values" }, data, display_order: 150 };
}

// --------------------------------------------------------------------
// entry_type par categorie SRD, et split de Equipment par equipment_category
// --------------------------------------------------------------------

const CATEGORY_ENTRY_TYPE: Record<string, EntryType> = {
  Spells: "spell",
  "Magic-Items": "magic_item",
  Poisons: "item",
  Classes: "class",
  Subclasses: "subclass",
  Features: "feature",
  Feats: "feature",
  Traits: "feature",
  "Weapon-Properties": "feature",
  "Weapon-Mastery-Properties": "feature",
  Monsters: "monster",
  Conditions: "condition",
  Rules: "rule",
  "Rule-Sections": "rule",
  Backgrounds: "background",
  Races: "species",
  Subraces: "species",
  Species: "species",
  Subspecies: "species",
};

/**
 * 2014 porte une seule categorie (equipment_category, objet singulier),
 * 2024 en porte plusieurs (equipment_categories, tableau) — les deux formes
 * sont couvertes ici plutot que dupliquees par version de SRD.
 *
 * `mount` (V1-D7, retour utilisateur) se detecte via `vehicle_category`,
 * seul champ fiable : les huit montures achetables (cheval, mule, chameau...)
 * portent `vehicle_category: "Mounts and Other Animals"` alors que leur
 * `equipment_category` reste le generique "Mounts and Vehicles" partage avec
 * le harnachement et les vehicules a rames — verifie sur les deux editions.
 */
function equipmentEntryType(entry: SrdRecord): EntryType {
  const single = entry.equipment_category as SrdRecord | undefined;
  const multiple = entry.equipment_categories as SrdRecord[] | undefined;
  const names = [
    ...(single ? [single.name] : []),
    ...(multiple ? multiple.map((c) => c.name) : []),
  ].filter((n): n is string => typeof n === "string");

  if (entry.vehicle_category === "Mounts and Other Animals") return "mount";
  if (names.some((n) => /armor|shield/i.test(n))) return "armor";
  if (names.some((n) => /weapon/i.test(n))) return "weapon";
  return "item";
}

/**
 * Deux entrees "Equipment" sont en realite des lignes de cout de la regle
 * "Pieces de monnaie" (ecuries, fourrage), pas des objets — V1-D7, retour
 * utilisateur explicite ("ecurie par jour... plutot une regle generale de
 * cout non ?"). Exclues ici plutot que reclassees : leur contenu rejoint
 * `standard-exchange-rates` a la main (aucune fiche Objet equivalente).
 */
const EXCLUDED_SERVICE_COST_INDICES = new Set(["stabling-1-day", "animal-feed-1-day"]);

// --------------------------------------------------------------------
// Transformation d'une entree brute -> entree typee (blocs)
// --------------------------------------------------------------------

function transformEntry(
  category: string,
  entry: SrdRecord,
  sourceAttribution: string,
  levelsByCategory: SrdRecord[] | undefined,
  remapFeatureKey: Map<string, string>,
  subclassesByCategory: SrdRecord[] | undefined,
  speciesAndSubspeciesKeys: Set<string>
): TransformedEntry {
  const entryType: EntryType = category === "Equipment" ? equipmentEntryType(entry) : CATEGORY_ENTRY_TYPE[category];

  const blocks: EntryBlock[] = [];

  const prose = extractProse(entry);
  // Condition retombe toujours sur le repli generique (V1-D7, sur retour
  // utilisateur) : sa prose SRD entiere (intro + effets en gras) devient
  // `condition_effects` plus bas, la description generique sert seulement
  // de support au lore invente ecrit a la main (meme motif qu'Historique
  // — background) — jamais le texte source brut ici, redondant avec le
  // bloc effets.
  if (prose && entryType !== "condition") {
    blocks.push(descriptionBlock(prose));
  } else if (entryType === "monster") {
    const size = entry.size;
    const type = entry.type;
    const alignment = entry.alignment;
    const ac = entry.armor_class;
    const hp = entry.hit_points;
    const hitDice = entry.hit_dice;
    const cr = entry.challenge_rating;
    blocks.push(
      descriptionBlock(
        `${String(entry.name)} — ${String(size)} ${String(type)}, ${String(alignment)}. ` +
          `CA ${JSON.stringify(ac)}, PV ${String(hp)} (${String(hitDice)}). FP ${String(cr)}.`
      )
    );
  } else {
    blocks.push(descriptionBlock(`${String(entry.name)} — voir le tableau de donnees pour le detail.`));
  }

  if (entryType === "spell") {
    blocks.push(...spellBlocks(entry));
  }

  if (entryType === "class" && levelsByCategory) {
    blocks.push(classProgressionBlock(String(entry.index), levelsByCategory, remapFeatureKey, sourceAttribution));
    blocks.push(classBasicsBlock(entry));
    const spellcasting = spellcastingProgressionBlock(entry);
    if (spellcasting) blocks.push(spellcasting);
    if (subclassesByCategory) {
      blocks.push(subclassSlotBlock(String(entry.index), subclassesByCategory, levelsByCategory));
    }
    const classEquipment = classEquipmentBlock(entry);
    if (classEquipment) blocks.push(classEquipment);
  }

  if (entryType === "weapon") {
    const weapon = weaponBlock(entry);
    if (weapon) blocks.push(weapon);
  }

  if (entryType === "armor") {
    const armor = armorBlock(entry);
    if (armor) blocks.push(armor);
  }

  if (entryType === "item" || entryType === "magic_item" || entryType === "mount") {
    const itemProperties = itemPropertiesBlock(entry, sourceAttribution);
    if (itemProperties) blocks.push(itemProperties);
  }

  if (entryType === "monster") {
    const statBlock = statBlockBlock(entry);
    if (statBlock) blocks.push(statBlock);
    const actions = actionsBlock(entry);
    if (actions) blocks.push(actions);
    const legendaryActions = legendaryActionsBlock(entry);
    if (legendaryActions) blocks.push(legendaryActions);
    const traits = traitsBlock(entry);
    if (traits) blocks.push(traits);
  }

  if (category === "Feats") {
    const prerequisites = prerequisitesBlock(entry);
    if (prerequisites) blocks.push(prerequisites);
  }

  if (entryType === "background") {
    const background = backgroundBlock(entry);
    if (background) blocks.push(background);
  }

  if (entryType === "condition") {
    const effects = conditionEffectsBlock(entry);
    if (effects) blocks.push(effects);
  }

  if (entryType === "subclass") {
    const features = subclassFeaturesBlock(entry);
    if (features) blocks.push(features);
  }

  if (entryType === "species") {
    const speciesTraits = speciesTraitsBlock(entry, speciesAndSubspeciesKeys);
    if (speciesTraits) blocks.push(speciesTraits);
  }

  blocks.push(customTableBlock(entry));

  const digestSource = prose ?? fallbackDigestFacts(entryType, entry) ?? String(entry.name);
  const ai_digest = truncateForDigest(`${String(entry.name)} (${entryType}) — ${digestSource}`);

  // Prefixe dedie pour les proprietes d'arme (V1-C12) : leurs index bruts
  // ("light", "monk", "ammunition"...) sont des mots ordinaires qui
  // percutent presque a coup sur un sort, une classe ou un objet du meme
  // nom — le desambiguateur generique plus bas (`${cle}-${entry_type}`)
  // suffit a eviter un doublon en base, mais reste dangereux a deviner cote
  // client : `weaponData.properties` porte toujours l'index brut ("light"),
  // et sans prefixe distinct la fiche resolue a cette cle serait celle du
  // sort "Light", pas de la propriete — un lien vers le mauvais contenu,
  // pas juste une fiche manquante. Le prefixe rend la cle intrinsequement
  // sans collision possible, pas seulement corrigee apres coup. Meme motif
  // pour les bottes d'arme (V1-D7) : "slow" percuterait le sort Lenteur.
  const entryKey =
    category === "Weapon-Properties"
      ? `weapon-property-${String(entry.index)}`
      : category === "Weapon-Mastery-Properties"
        ? `weapon-mastery-${String(entry.index)}`
        : String(entry.index);

  return {
    entry_key: entryKey,
    entry_type: entryType,
    ai_digest,
    source_attribution: sourceAttribution,
    source_raw: entry,
    blocks,
    refs: extractDerivedRefs(blocks),
  };
}

// --------------------------------------------------------------------
// Import d'une version du SRD
// --------------------------------------------------------------------

function readSrdFile(file: string): Record<string, SrdRecord[]> {
  const filePath = resolve(process.cwd(), file);
  return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, SrdRecord[]>;
}

interface ImportResult {
  counts: Record<EntryType, number>;
  blocksTotal: number;
  refsTotal: number;
  failures: ConversionFailure[];
}

async function importSrdVersion(config: SrdVersionConfig): Promise<ImportResult> {
  const ownData = readSrdFile(config.file);
  const raw = config.mergeWithBaseFile
    ? buildMergedDataset(readSrdFile(config.mergeWithBaseFile), ownData)
    : ownData;

  const { data: rulesetId, error: rulesetError } = await supabase.rpc("import_upsert_ruleset", {
    p_base_system: config.baseSystem,
    p_name: config.rulesetName,
  });
  if (rulesetError) throw new Error(`import_upsert_ruleset (${config.file}) : ${rulesetError.message}`);

  const levels = raw["Levels"];
  // `subclass_slot` (label + niveau de choix) doit lire les sous-classes de
  // l'edition courante, jamais le jeu fusionne : `buildMergedDataset` garde
  // par construction les entrees 2014 dont l'`index` a change en 2024 (ex.
  // barbare : "berserker" -> "path-of-the-berserker", 2014 reste present a
  // cote), et `raw["Subclasses"]` melangerait alors une sous-classe perimee
  // avec son remplacement 2024 sous le meme `class.index`. `ownData` (avant
  // fusion) ne porte que les 12 sous-classes reellement 2024 — verifie
  // couvrir les 12 classes de base avant d'ecrire ce repli.
  const subclassesForSlots = config.mergeWithBaseFile ? ownData["Subclasses"] : raw["Subclasses"];

  // Cles des especes/sous-especes (V1-D7) : necessaire pour predire quelles
  // entrees "Traits" seront desambiguisees plus bas dans cette meme passe —
  // une sous-espece et son aptitude descriptive partagent parfois le meme
  // index brut (ex. "giant-ancestry-clouds-jaunt", Goliath). Species/
  // Subspecies sont traitees avant Traits dans l'ordre du fichier source
  // (voir la boucle de desambiguation plus bas), donc l'aptitude perd
  // toujours la cle nue et recoit le suffixe "-feature" — deterministe,
  // jamais devine dans speciesTraitsBlock.
  const speciesAndSubspeciesKeys = new Set([
    ...(Array.isArray(raw["Species"]) ? raw["Species"].map((e) => String(e.index)) : []),
    ...(Array.isArray(raw["Subspecies"]) ? raw["Subspecies"].map((e) => String(e.index)) : []),
  ]);

  const counts: Partial<Record<EntryType, number>> = {};
  const failures: ConversionFailure[] = [];
  let blocksTotal = 0;
  let refsTotal = 0;

  // Regroupe en amont les aptitudes generiques identiques (V1-A2) : le
  // remap doit exister avant de traiter la categorie Classes, quel que soit
  // l'ordre d'iteration des categories dans le fichier source.
  const featureItems = raw["Features"];
  const featureDedup = Array.isArray(featureItems) ? dedupeFeatures(featureItems) : undefined;
  if (featureDedup) {
    const dedupedCount = featureItems!.length - featureDedup.canonicalEntries.length;
    if (dedupedCount > 0) {
      console.log(
        `  aptitudes generiques : ${featureItems!.length} entrees -> ${featureDedup.canonicalEntries.length} fiches (${dedupedCount} doublons fusionnes)`
      );
    }
  }
  const remapFeatureKey = featureDedup?.canonicalKeyByOriginalKey ?? new Map<string, string>();

  // Deux passes : la premiere transforme tout et desambiguise les
  // collisions d'entry_key entre categories (le SRD a par exemple a la
  // fois un background et un monstre nommes "Acolyte" — meme index, types
  // differents). La cle canonique reste stable et deterministe : seule
  // l'entree en collision recoit un suffixe de type, jamais la premiere
  // rencontree dans l'ordre naturel du fichier.
  const byCategory: { category: string; entries: TransformedEntry[] }[] = [];
  const seenKeys = new Set<string>();

  for (const [category, items] of Object.entries(raw)) {
    if (SKIPPED_CATEGORIES.has(category)) continue;
    if (!Array.isArray(items)) continue;
    const isMapped = category === "Equipment" || category in CATEGORY_ENTRY_TYPE;
    if (!isMapped) continue;

    const sourceItems = category === "Features" && featureDedup ? featureDedup.canonicalEntries : items;

    const transformed: TransformedEntry[] = [];
    for (const item of sourceItems) {
      if (typeof item.index === "string" && EXCLUDED_SERVICE_COST_INDICES.has(item.index)) continue;
      try {
        const t = transformEntry(category, item, config.sourceAttribution, levels, remapFeatureKey, subclassesForSlots, speciesAndSubspeciesKeys);
        transformed.push(t);
        blocksTotal += t.blocks.length;
        refsTotal += t.refs.length;
      } catch (err) {
        failures.push({
          rulesetFile: config.file,
          category,
          entryKey: String(item.index ?? "?"),
          entryName: String(item.name ?? "?"),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (const t of transformed) {
      if (seenKeys.has(t.entry_key)) {
        const disambiguated = `${t.entry_key}-${t.entry_type}`;
        console.warn(
          `  collision d'entry_key '${t.entry_key}' (categorie ${category}) -> renomme en '${disambiguated}'`
        );
        t.entry_key = disambiguated;
      }
      seenKeys.add(t.entry_key);
      counts[t.entry_type] = (counts[t.entry_type] ?? 0) + 1;
    }

    byCategory.push({ category, entries: transformed });
  }

  for (const { category, entries } of byCategory) {
    if (entries.length === 0) continue;
    const { error } = await supabase.rpc("import_srd_entries", {
      p_ruleset_id: rulesetId,
      p_entries: entries,
    });
    if (error) {
      throw new Error(`import_srd_entries (${config.file}, ${category}) : ${error.message}`);
    }
  }

  // Purge les entry_key qui n'existent plus dans ce jeu de donnees (ex :
  // les anciennes variantes par classe d'une aptitude generique, fusionnees
  // par dedupeFeatures) — sans ca, rejouer l'import laisserait des fiches
  // mortes en base indefiniment (blocs et traductions cascadent avec elles).
  const { data: prunedCount, error: pruneError } = await supabase.rpc("import_prune_stale_entries", {
    p_ruleset_id: rulesetId,
    p_valid_keys: [...seenKeys],
  });
  if (pruneError) throw new Error(`import_prune_stale_entries (${config.file}) : ${pruneError.message}`);
  if (typeof prunedCount === "number" && prunedCount > 0) {
    console.log(`  fiches obsoletes retirees : ${prunedCount}`);
  }

  return { counts: counts as Record<EntryType, number>, blocksTotal, refsTotal, failures };
}

async function main() {
  console.log("Import SRD — aucune donnee hors data/srd/srd-2014.json / data/srd/srd-2024.json n'est consultee.\n");

  const allFailures: ConversionFailure[] = [];

  for (const config of SRD_VERSIONS) {
    console.log(`--- ${config.rulesetName} ---`);
    const { counts, blocksTotal, refsTotal, failures } = await importSrdVersion(config);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    for (const [entryType, count] of Object.entries(counts).sort()) {
      console.log(`  ${entryType.padEnd(12)} ${count}`);
    }
    console.log(`  ${"total".padEnd(12)} ${total}`);
    console.log(`  ${"blocs".padEnd(12)} ${blocksTotal}`);
    console.log(`  ${"renvois".padEnd(12)} ${refsTotal}`);
    console.log(`  ${"echecs".padEnd(12)} ${failures.length}\n`);
    allFailures.push(...failures);
  }

  if (allFailures.length > 0) {
    console.log(`--- Echecs de conversion (${allFailures.length}) ---`);
    for (const f of allFailures) {
      console.log(`  [${f.rulesetFile}] ${f.category}/${f.entryKey} ("${f.entryName}") : ${f.message}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Aucun echec de conversion.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
