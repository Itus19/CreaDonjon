import { z } from "zod";
import { zBlockReference } from "./reference";

const zItemCommon = z.object({
  id: z.string().min(1),
  qty: z.number().nonnegative(),
  equipped: z.boolean().optional(),
  attuned: z.boolean().optional(),
  slot: z.string().optional(),
  weight: z.object({ value: z.number(), unit: z.string() }).optional(),
  notes: z.string().optional(),
});

/**
 * Trois natures d'objet, et il faut les trois (specs/wiki-blocs.md §4.1) :
 * une reference de regle (poids/degats/proprietes viennent de la fiche de
 * regle), une reference d'entite (a une histoire, une fiche de wiki), ou un
 * objet en ligne, promouvable en entite plus tard.
 */
const zRuleOrEntityItem = zItemCommon.extend({ ref: zBlockReference });
const zInlineItem = zItemCommon.extend({ label: z.string().min(1) });
export const zInventoryItem = z.union([zRuleOrEntityItem, zInlineItem]);
export type InventoryItem = z.infer<typeof zInventoryItem>;

const zContainer = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  contains: z.array(z.string()),
});

const zCurrency = z.object({
  pp: z.number().nonnegative(),
  gp: z.number().nonnegative(),
  ep: z.number().nonnegative(),
  sp: z.number().nonnegative(),
  cp: z.number().nonnegative(),
});

export const zInventoryBlockData = z.object({
  __v: z.literal(1),
  items: z.array(zInventoryItem),
  containers: z.array(zContainer),
  currency: zCurrency,
});
export type InventoryBlockData = z.infer<typeof zInventoryBlockData>;
