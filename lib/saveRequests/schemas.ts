import { z } from "zod";

/**
 * V3.1-111 (ADR 0044) — répondre à une sauvegarde demandée. « roll » : le
 * serveur tire (règle 8). « die » : le vrai dé de la table ; `natural` est
 * le d20 (1 à 20), ou le total déjà fait si `modifierIncluded` (borné comme
 * en base).
 */
export const answerSaveRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("roll") }),
  z
    .object({ mode: z.literal("die"), natural: z.number().int().min(-10).max(60), modifierIncluded: z.boolean() })
    .refine((v) => v.modifierIncluded || (v.natural >= 1 && v.natural <= 20), { message: "Un d20 naturel va de 1 à 20.", path: ["natural"] }),
]);
export type AnswerSaveRequestInput = z.infer<typeof answerSaveRequestSchema>;
