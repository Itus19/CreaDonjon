import { z } from "zod";
import { zBlockDisplay } from "./envelope";
import { zTextBlockData } from "./text";
import { zInfoboxBlockData } from "./infobox";
import { zImageBlockData } from "./image";
import { zCustomTableBlockData } from "./customTable";
import { zCharacterBlockData } from "./character";
import { zInventoryBlockData } from "./inventory";
import { zSpellcastingBlockData } from "./spellcasting";
import { zResourcesBlockData } from "./resources";
import { zStatblockBlockData } from "./statblock";
import { zRandomTableBlockData } from "./randomTable";
import { zGeneratorBlockData } from "./generator";
import { zMusicBlockData } from "./music";
import { zGenealogyBlockData } from "./genealogy";
import { zQuestBlockData } from "./quest";
import { zSessionLogBlockData } from "./sessionLog";
import { zPersonalityBlockData } from "./personality";
import { zRelationshipBlockData } from "./relationship";
import { zWorldviewBlockData } from "./worldview";
import { zRelationsGraphBlockData } from "./relationsGraph";
import { zTimelineBlockData } from "./timeline";
import { PERSONALITY_POLE_KEYS, WORLDVIEW_POLE_KEYS } from "@/src/core/psyche/keys";

/**
 * Catalogue des blocs de wiki (specs/wiki-blocs.md §1, docs/SCHEMA.md §7).
 * V0 : text, infobox, image, custom_table (`text` ex-`description` et
 * `image` ex-`gallery`, renommes en V0-06e). V1 (V1-B2) : character,
 * inventory, spellcasting, resources, statblock. V1-E1 : random_table
 * (specs/outils-mj.md §2) — attache entite seulement pour l'instant,
 * l'attache ruleset (bibliotheque partagee) reste a ouvrir avec son propre
 * cas concret (regle des trois, meme decision que V1-D4 pour weapon).
 * V1-E2 : generator (specs/outils-mj.md §3) — trois emplois concrets
 * (noms, rumeurs, butin), pas la recette complete a `rule_query`/promotion
 * en entite de la spec (V2, cf. src/core/generators/types.ts).
 * Pas de bloc `encounter` : le generateur de rencontres (V1-E3) est un
 * outil d'ecran MJ autonome (table `campaign_encounters`), jamais attache
 * a une fiche — decision explicite de l'utilisateur, revenant sur le plan
 * initial de docs/SCHEMA.md qui le prevoyait en bloc V2.
 * V2-G3 : music — jamais de fichier audio heberge par nous, une "station"
 * est un bloc nomme portant une liste de liens Spotify/SoundCloud/YouTube
 * (`src/core/music/embedUrl.ts` valide le domaine et traduit chaque lien
 * en URL d'integration). Le nom de la station est choisi par la personne
 * elle-meme (le `display.label` du bloc, comme tout bloc) — jamais une
 * categorie ou une marque de franchise fournie par l'application.
 * V2-H3 : genealogy — arbre genealogique derive de `relations`, jamais
 * stocke lui-meme (specs/wiki-blocs.md §2). Pas de bloc `relationships`
 * (liste simple) separe : cette information est deja affichee sans
 * condition en tete de fiche (`RelationsChips.tsx`/`PublicRelations.tsx`,
 * V2-G11), un bloc dedie ne ferait que la dupliquer.
 * V2-H4 : quest — cocher un objectif est un fait de partie, pas une simple
 * edition redactionnelle : passe par sa propre route
 * (`app/api/blocks/[blockId]/quest-objective`), qui ecrit aussi un
 * `session_event` (kind `world_update`, meme convention que
 * `runtimeState.ts`) si une session de campagne est ouverte pour le monde.
 * V2-H4 : session_log — vue epinglee sur UNE session (`sessionId`), jamais
 * une copie de son resume : `sessions.summary` reste la seule source de
 * verite (docs/SCHEMA.md §12), ce bloc ne fait que la montrer/l'editer a
 * cote de son fil de `session_events`.
 * V2-H1 : personality — temperament d'une entite, portee entite (pas
 * campagne, docs/adr/0013-tables-psyche-pnj.md). Les valeurs de `poles`
 * changent uniquement via `POST /api/blocks/[id]/personality-event`
 * (journalise dans `personality_events` ET applique le delta), jamais par
 * le PATCH generique des blocs.
 * V2-H1 : relationship — un bloc par relation, mais ne stocke PAS les
 * valeurs d'axes : elles vivent dans `entity_attitudes`/`attitude_events`,
 * portee CAMPAGNE (contrairement a `personality`). Le bloc ne porte que le
 * structurel (cible, `knownAs`, `historyVisible`) ; les axes se lisent/
 * s'ecrivent via `src/server/services/psyche.ts` (memes fonctions que
 * `personality`, pattern partage, portee differente).
 * V2-H1 : worldview — convictions morales/politiques, meme portee que
 * `personality` (l'entite seule). Partage le meme journal
 * (`personality_events`) plutot qu'une nouvelle table : filtre par cles
 * de poles a l'affichage, jamais un evenement mal range.
 * V2-H1 : relations_graph — graphe auto-organise des vraies relations de
 * l'entite (n'importe quel type, contrairement a `genealogy`). Fourche
 * tranchee avec l'utilisateur : ce qu'il decrivait pour "worldview"
 * (survol des liens, degre configurable, masquage coordonne) n'a de sens
 * que sur un vrai graphe de relations, jamais sur des poles abstraits —
 * devient ce bloc separe plutot qu'une fonctionnalite de `worldview`.
 * V2-H2 : timeline — entrees en ligne d'une chronologie, attachable a
 * n'importe quelle entite, plusieurs fois (specs/wiki-blocs.md §7). Chaque
 * entree porte toujours sa propre date complete ; `ref` (vers une entite
 * `event` promue) ne sert qu'a la navigation, jamais de source de date —
 * simplification actee avec l'utilisateur par rapport a la requete
 * `scope.query` par tags de la spec, remplacee par la vue generale du
 * monde qui agrege directement les entrees de tous les blocs `timeline`.
 */
export const BLOCK_TYPES = [
  "text",
  "infobox",
  "image",
  "custom_table",
  "character",
  "inventory",
  "spellcasting",
  "resources",
  "statblock",
  "random_table",
  "generator",
  "music",
  "genealogy",
  "quest",
  "session_log",
  "personality",
  "relationship",
  "worldview",
  "relations_graph",
  "timeline",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const DEFAULT_LAYOUT_BY_BLOCK_TYPE: Record<BlockType, BlockDisplayLayout> = {
  text: "prose",
  infobox: "key_values",
  image: "image",
  custom_table: "table",
  character: "character",
  inventory: "inventory",
  spellcasting: "spellcasting",
  resources: "resources",
  statblock: "statblock",
  random_table: "table",
  generator: "prose",
  music: "music",
  genealogy: "graph",
  quest: "quest",
  session_log: "session_log",
  personality: "poles",
  relationship: "poles",
  worldview: "poles",
  relations_graph: "graph",
  timeline: "timeline",
};
type BlockDisplayLayout = z.infer<typeof zBlockDisplay>["layout"];

const DATA_SCHEMA_BY_BLOCK_TYPE = {
  text: zTextBlockData,
  infobox: zInfoboxBlockData,
  image: zImageBlockData,
  custom_table: zCustomTableBlockData,
  character: zCharacterBlockData,
  inventory: zInventoryBlockData,
  spellcasting: zSpellcastingBlockData,
  resources: zResourcesBlockData,
  statblock: zStatblockBlockData,
  random_table: zRandomTableBlockData,
  generator: zGeneratorBlockData,
  music: zMusicBlockData,
  genealogy: zGenealogyBlockData,
  quest: zQuestBlockData,
  session_log: zSessionLogBlockData,
  personality: zPersonalityBlockData,
  relationship: zRelationshipBlockData,
  worldview: zWorldviewBlockData,
  relations_graph: zRelationsGraphBlockData,
  timeline: zTimelineBlockData,
} satisfies Record<BlockType, z.ZodTypeAny>;

const DEFAULT_DATA_BY_BLOCK_TYPE: Record<BlockType, unknown> = {
  text: { __v: 1, segments: [] },
  infobox: { __v: 1, entries: [] },
  image: {
    __v: 1,
    url: "",
    caption: "",
    wrapMode: "intercalate",
    align: "center",
    sizePct: 100,
    useAsWikiBackground: false,
    backgroundBlurPx: 20,
    fadeMs: 600,
  },
  custom_table: { __v: 1, columns: [], rows: [] },
  random_table: {
    __v: 1,
    key: "nouvelle-table",
    die: "d20",
    entries: [{ range: { min: 1, max: 20 }, weight: 20, text: "Nouveau résultat" }],
    unique_draws: false,
  },
  generator: {
    __v: 1,
    slots: [{ key: "resultat", table: "nouvelle-table" }],
    template: "{resultat}",
  },
  character: {
    __v: 1,
    species: null,
    background: null,
    classes: [],
    abilities: { method: "standard_array", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    choices: {},
    hp_method: "fixed",
    portrait_asset_id: null,
    gender: "unspecified",
    pronouns: "",
  },
  inventory: { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
  spellcasting: { __v: 1, sources: [], known: [], prepared: [], slot_override: null },
  resources: { __v: 1, trackers: [] },
  statblock: {
    __v: 1,
    size: "Moyenne",
    creature_type: "humanoïde",
    ac: { value: 10 },
    hp: { value: 4 },
    speed: "9 m",
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    traits: [],
    actions: [],
    reactions: [],
    legendary_actions: [],
  },
  music: { __v: 1, tracks: [] },
  genealogy: { __v: 1, rootEntityId: null, depthUp: 2, depthDown: 2 },
  quest: { __v: 1, state: "not_started", giver: null, objectives: [], rewards: [], prerequisites: [] },
  session_log: { __v: 1, sessionId: null },
  personality: {
    __v: 1,
    poles: PERSONALITY_POLE_KEYS.map((key) => ({ key, value: 0 })),
    priority: [],
    aspirations: [],
    lines: [],
    limits: [],
    baseline: { trust: 0, affinity: 0, respect: 0, fear: 0 },
    speech: { register: "", tics: [] },
  },
  relationship: { __v: 1, target: null, knownAs: "", historyVisible: 20 },
  worldview: { __v: 1, poles: WORLDVIEW_POLE_KEYS.map((key) => ({ key, value: 0 })), priority: [] },
  relations_graph: { __v: 1, rootEntityId: null, degreesVisible: 1 },
  timeline: { __v: 1, entries: [], groupBy: "none" },
};

export function dataSchemaForBlockType(blockType: BlockType): z.ZodTypeAny {
  return DATA_SCHEMA_BY_BLOCK_TYPE[blockType];
}

export function validateBlockData(blockType: BlockType, data: unknown) {
  return dataSchemaForBlockType(blockType).parse(data);
}

export function defaultBlockData(blockType: BlockType): unknown {
  return DEFAULT_DATA_BY_BLOCK_TYPE[blockType];
}

export function defaultBlockDisplay(blockType: BlockType, label: string) {
  return { label, layout: DEFAULT_LAYOUT_BY_BLOCK_TYPE[blockType] };
}
