import { z } from "zod";
import { zMapElementRef } from "@/src/core/schemas/mapElementRef";
import { zMapRegionColor, zMapRegionShape } from "@/src/core/schemas/mapRegion";
import { zVisibilityInput } from "@/lib/visibility/schemas";

/**
 * Zone (Lot I, phase D) — `ref` et `name` sont INDEPENDANTS (retour
 * utilisateur, point 1), meme discipline que map_pins.
 */
export const createMapRegionSchema = z.object({
  name: z.string().trim().max(200, "200 caracteres maximum.").default(""),
  ref: zMapElementRef.nullable().default(null),
  shape: zMapRegionShape,
  fillColor: zMapRegionColor.default("#3b82f6"),
  borderColor: zMapRegionColor.default("#1d4ed8"),
  layerId: z.string().nullable().default(null),
  visibility: zVisibilityInput,
});

export const updateMapRegionSchema = z.object({
  name: z.string().trim().max(200, "200 caracteres maximum.").optional(),
  ref: zMapElementRef.nullable().optional(),
  shape: zMapRegionShape.optional(),
  fillColor: zMapRegionColor.optional(),
  borderColor: zMapRegionColor.optional(),
  layerId: z.string().nullable().optional(),
  visibility: zVisibilityInput.optional(),
});
