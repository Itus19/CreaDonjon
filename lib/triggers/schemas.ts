import { z } from "zod";
import { TRIGGER_EVENTS, TRIGGER_ZONES, zTrigger } from "@/src/core/rules/triggers";

/**
 * Entree du bac a sable de declencheurs (V3-A5). Validee par Zod comme
 * toute entree de route serveur (CLAUDE.md regle 4).
 *
 * Le contexte est SAISI par l'utilisateur, pas lu en base : le bac a sable
 * ne doit toucher aucune vraie partie (critere du ticket). C'est aussi ce
 * qui le rend utile — on y essaie « et si le personnage etait concentre,
 * a 3 PV, et que le coup faisait 22 degats ? » sans avoir a mettre un
 * personnage reel dans cet etat.
 */
export const simulateTriggersSchema = z.object({
  triggers: z.array(zTrigger).min(1).max(32),
  event: z.object({
    event: z.enum(TRIGGER_EVENTS),
    subject: z.string().min(1),
    /** Donnees de l'evenement, deja prefixees `event.` (ex. `event.damage`). */
    data: z.record(z.string(), z.number()).optional(),
    tags: z.array(z.string().min(1)).max(16).optional(),
  }),
  actors: z
    .record(
      z.string().min(1),
      z.object({
        conditions: z.array(z.string().min(1)).default([]),
        features: z.array(z.string().min(1)).default([]),
        numbers: z.record(z.string(), z.number()).default({}),
        zone: z.enum(TRIGGER_ZONES).optional(),
      }),
    )
    .refine((a) => Object.keys(a).length > 0, { message: "Au moins un acteur est necessaire." }),
});

export type SimulateTriggersInput = z.infer<typeof simulateTriggersSchema>;
