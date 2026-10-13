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
  // V3.1-113 (ADR 0045) : `short_rest_one` — une utilisation rendue au repos
  // court, toutes au repos long (Rage, Conduit divin en 2024). Valeur ajoutée
  // à l'énumération : les blocs existants restent valides, `__v` ne change pas.
  recharge: z.enum(["short_rest", "short_rest_one", "long_rest", "dawn", "never"]),
  // Couvre les "compteurs personnalises" : jauge d'objet, ressource de
  // sous-classe, aptitude maison, sans source de regle.
  custom: z.boolean().optional(),
});

export const zResourcesBlockData = z.object({
  __v: z.literal(1),
  trackers: z.array(zResourceTracker),
});
export type ResourcesBlockData = z.infer<typeof zResourcesBlockData>;
