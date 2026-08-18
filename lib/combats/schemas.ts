import { z } from "zod";

/** "Lancer le combat" (V1-E4) depuis la composition de Rencontres (V1-E3) — les PJ ne sont pas inclus ici, ajoutes ensuite depuis l'ecran d'initiative. */
export const createCombatSchema = z.object({
  name: z.string().trim().max(200).nullable().default(null),
  monsters: z.array(
    z.object({
      entryKey: z.string().trim().min(1),
      label: z.string().trim().min(1),
      count: z.number().int().positive().max(50),
    })
  ),
});

/** Renommage et/ou changement de statut manuel (V1-E4) — au moins un des deux, jamais un corps vide. */
export const patchCombatSchema = z
  .object({
    name: z.string().trim().max(200).nullable().optional(),
    status: z.enum(["draft", "running", "ended"]).optional(),
  })
  .refine((data) => data.name !== undefined || data.status !== undefined, { message: "Rien à modifier." });

export const turnSchema = z.object({
  direction: z.enum(["next", "previous"]),
});

export const rollInitiativeSchema = z.object({
  participantId: z.string().trim().min(1).nullable().default(null),
});

/** Ajout d'un participant en cours de combat — trois provenances (specs/outils-mj.md §5.1), une seule renseignee a la fois. */
export const addParticipantSchema = z.discriminatedUnion("sourceKind", [
  z.object({ sourceKind: z.literal("entity"), entityId: z.string().trim().min(1), isAlly: z.boolean().default(true) }),
  z.object({
    sourceKind: z.literal("statblock"),
    entryKey: z.string().trim().min(1),
    label: z.string().trim().min(1),
    isAlly: z.boolean().default(false),
  }),
  z.object({ sourceKind: z.literal("custom"), label: z.string().trim().min(1), isAlly: z.boolean().default(false) }),
]);

export const patchParticipantSchema = z.object({
  initiative: z.number().int().optional(),
  ac: z.number().int().positive().optional(),
  hpCurrent: z.number().int().nonnegative().optional(),
  tempHp: z.number().int().nonnegative().optional(),
  conditions: z.array(z.string()).optional(),
  concentration: z.object({ label: z.string().trim().min(1) }).nullable().optional(),
  note: z.string().trim().min(1).max(200),
});
