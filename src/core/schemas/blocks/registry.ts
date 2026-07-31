import { z } from "zod";
import { zBlockDisplay } from "./envelope";
import { zDescriptionBlockData } from "./description";
import { zInfoboxBlockData } from "./infobox";
import { zGalleryBlockData } from "./gallery";
import { zCustomTableBlockData } from "./customTable";

/**
 * Catalogue V0 des blocs de wiki (specs/wiki-blocs.md §1, docs/SCHEMA.md §7).
 * `character` (et le reste) vient en V1 — ne pas anticiper.
 */
export const BLOCK_TYPES = ["description", "infobox", "gallery", "custom_table"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const DEFAULT_LAYOUT_BY_BLOCK_TYPE: Record<BlockType, BlockDisplayLayout> = {
  description: "prose",
  infobox: "key_values",
  gallery: "gallery",
  custom_table: "table",
};
type BlockDisplayLayout = z.infer<typeof zBlockDisplay>["layout"];

const DATA_SCHEMA_BY_BLOCK_TYPE = {
  description: zDescriptionBlockData,
  infobox: zInfoboxBlockData,
  gallery: zGalleryBlockData,
  custom_table: zCustomTableBlockData,
} satisfies Record<BlockType, z.ZodTypeAny>;

const DEFAULT_DATA_BY_BLOCK_TYPE: Record<BlockType, unknown> = {
  description: { __v: 1, segments: [] },
  infobox: { __v: 1, entries: [] },
  gallery: { __v: 1, images: [] },
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
