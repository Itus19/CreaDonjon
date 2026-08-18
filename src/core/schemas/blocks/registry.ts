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
} satisfies Record<BlockType, z.ZodTypeAny>;

const DEFAULT_DATA_BY_BLOCK_TYPE: Record<BlockType, unknown> = {
  text: { __v: 1, segments: [] },
  infobox: { __v: 1, entries: [] },
  image: { __v: 1, url: "", caption: "" },
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
