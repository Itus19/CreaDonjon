import { z } from "zod";
import { zMapElementRef } from "@/src/core/schemas/mapElementRef";
import {
  DEFAULT_MAP_REGION_BORDER,
  DEFAULT_MAP_REGION_FILL,
  zMapRegionColor,
  zMapRegionShape,
} from "@/src/core/schemas/mapRegion";
import { zVisibilityInput } from "@/lib/visibility/schemas";

/**
 * Zone (Lot I, phase D) — `ref` et `name` sont INDEPENDANTS (retour
 * utilisateur, point 1), meme discipline que map_pins.
 */
export const createMapRegionSchema = z.object({
  name: z.string().trim().max(200, "200 caracteres maximum.").default(""),
  ref: zMapElementRef.nullable().default(null),
  shape: zMapRegionShape,
  fillColor: zMapRegionColor.default(DEFAULT_MAP_REGION_FILL),
  borderColor: zMapRegionColor.default(DEFAULT_MAP_REGION_BORDER),
  layerId: z.string().nullable().default(null),
  /** V2-I2 (brouillard de guerre) — faux par defaut : une zone reste visible comme avant ce ticket sauf choix contraire. */
  fogGated: z.boolean().default(false),
  visibility: zVisibilityInput,
});

export const updateMapRegionSchema = z.object({
  name: z.string().trim().max(200, "200 caracteres maximum.").optional(),
  ref: zMapElementRef.nullable().optional(),
  shape: zMapRegionShape.optional(),
  fillColor: zMapRegionColor.optional(),
  borderColor: zMapRegionColor.optional(),
  layerId: z.string().nullable().optional(),
  fogGated: z.boolean().optional(),
  visibility: zVisibilityInput.optional(),
});
