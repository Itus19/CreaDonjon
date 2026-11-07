import { z } from "zod";

/**
 * V3.1-160 (ADR 0075) — ce qu'on fait d'une fenêtre de réaction : répondre
 * (sa propre ligne), « Continuer » (le MJ), ou reprendre (l'auteur du jet,
 * quand elle s'est fermée sans lui).
 */
export const rollWindowActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("answer"), index: z.number().int().min(0).max(19), use: z.boolean() }),
  z.object({ action: z.literal("continue") }),
  z.object({ action: z.literal("resume") }),
]);
export type RollWindowAction = z.infer<typeof rollWindowActionSchema>;
