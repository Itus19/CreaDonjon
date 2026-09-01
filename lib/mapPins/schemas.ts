import { z } from "zod";
import { zMapPinRef, zMapPinSize } from "@/src/core/schemas/mapPin";
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
  ref: zMapPinRef.nullable().default(null),
  size: zMapPinSize.default("medium"),
  visibility: zVisibilityInput,
});

export const updateMapPinSchema = z.object({
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  label: z.string().trim().max(200, "200 caracteres maximum.").optional(),
  ref: zMapPinRef.nullable().optional(),
  size: zMapPinSize.optional(),
  visibility: zVisibilityInput.optional(),
});
