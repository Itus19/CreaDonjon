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

/**
 * Catalogue des blocs de wiki (specs/wiki-blocs.md §1, docs/SCHEMA.md §7).
 * V0 : text, infobox, image, custom_table (`text` ex-`description` et
 * `image` ex-`gallery`, renommes en V0-06e). V1 (V1-B2) : character,
 * inventory, spellcasting, resources, statblock.
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
} satisfies Record<BlockType, z.ZodTypeAny>;

const DEFAULT_DATA_BY_BLOCK_TYPE: Record<BlockType, unknown> = {
  text: { __v: 1, segments: [] },
  infobox: { __v: 1, entries: [] },
  image: { __v: 1, url: "", caption: "" },
  custom_table: { __v: 1, columns: [], rows: [] },
  character: {
    __v: 1,
    species: null,
    background: null,
    classes: [],
    abilities: { method: "standard_array", base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    choices: {},
    hp_method: "fixed",
    portrait_asset_id: null,
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
