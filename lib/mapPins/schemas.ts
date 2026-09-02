import { z } from "zod";
import { zMapPinSize } from "@/src/core/schemas/mapPin";
import { zMapElementRef } from "@/src/core/schemas/mapElementRef";
import { zVisibilityInput } from "@/lib/visibility/schemas";

/**
 * Punaise (Lot I, phase C) — `ref` et `label` sont INDEPENDANTS (retour
 * utilisateur, point 1) : le lien renvoie vers une fiche existante, le nom
 * s'affiche que ce lien existe ou non, jamais l'un derive de l'autre.
 */
export const createMapPinSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  label: z.string().trim().max(200, "200 caracteres maximum.").default(""),
  ref: zMapElementRef.nullable().default(null),
  size: zMapPinSize.default("medium"),
  layerId: z.string().nullable().default(null),
  visibility: zVisibilityInput,
});

export const updateMapPinSchema = z.object({
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  label: z.string().trim().max(200, "200 caracteres maximum.").optional(),
  ref: zMapElementRef.nullable().optional(),
  size: zMapPinSize.optional(),
  layerId: z.string().nullable().optional(),
  visibility: zVisibilityInput.optional(),
});
