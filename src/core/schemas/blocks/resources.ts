import { z } from "zod";
import { zBlockReference } from "./reference";
import { zFormulaNode } from "../rule-blocks/primitives";

const zResourceTracker = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  source: zBlockReference.optional(),
  // Formule plutot qu'un nombre : le maximum peut dependre du niveau
  // (meme AST que le reste du moteur, src/core/formula).
  max: z.object({ formula: zFormulaNode }),
  recharge: z.enum(["short_rest", "long_rest", "dawn", "never"]),
  // Couvre les "compteurs personnalises" : jauge d'objet, ressource de
  // sous-classe, aptitude maison, sans source de regle.
  custom: z.boolean().optional(),
});

export const zResourcesBlockData = z.object({
  __v: z.literal(1),
  trackers: z.array(zResourceTracker),
});
export type ResourcesBlockData = z.infer<typeof zResourcesBlockData>;
