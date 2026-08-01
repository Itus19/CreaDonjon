import { z } from "zod";
import { zBlockDisplay } from "./envelope";
import { zTextBlockData } from "./text";
import { zInfoboxBlockData } from "./infobox";
import { zImageBlockData } from "./image";
import { zCustomTableBlockData } from "./customTable";

/**
 * Catalogue V0 des blocs de wiki (specs/wiki-blocs.md §1, docs/SCHEMA.md §7).
 * `character` (et le reste) vient en V1 — ne pas anticiper. `text` (ex-
 * `description`) et `image` (ex-`gallery`) ont ete renommes en V0-06e.
 */
export const BLOCK_TYPES = ["text", "infobox", "image", "custom_table"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const DEFAULT_LAYOUT_BY_BLOCK_TYPE: Record<BlockType, BlockDisplayLayout> = {
  text: "prose",
  infobox: "key_values",
  image: "image",
  custom_table: "table",
};
type BlockDisplayLayout = z.infer<typeof zBlockDisplay>["layout"];

const DATA_SCHEMA_BY_BLOCK_TYPE = {
  text: zTextBlockData,
  infobox: zInfoboxBlockData,
  image: zImageBlockData,
  custom_table: zCustomTableBlockData,
} satisfies Record<BlockType, z.ZodTypeAny>;

const DEFAULT_DATA_BY_BLOCK_TYPE: Record<BlockType, unknown> = {
  text: { __v: 1, segments: [] },
  infobox: { __v: 1, entries: [] },
  image: { __v: 1, url: "", caption: "" },
  custom_table: { __v: 1, columns: [], rows: [] },
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
