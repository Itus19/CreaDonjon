import { z } from "zod";
import { PERSONALITY_POLE_KEYS } from "@/src/core/psyche/keys";

/**
 * Bloc `personality` (V2-H1, specs/psyche-pnj.md §2) : le temperament d'une
 * entite qui decide, portee entite (pas campagne — « Bram est Bram
 * partout »). Les valeurs de `poles` sont l'etat courant, tenues a jour par
 * `personality_events` (journal en ajout seul, src/server/services/psyche.ts)
 * — jamais ecrites en dehors de ce chemin.
 */

const zPersonalityPole = z.object({
  key: z.enum(PERSONALITY_POLE_KEYS),
  value: z.number().int().min(-100).max(100),
  note: z.string().optional(),
});

/** Meme forme que `zSegmentVisibility` (src/core/schemas/entities/segments.ts) — dupliquee plutot qu'importee, `src/core/**` n'importe rien hors de lui-meme (CLAUDE.md regle 14). */
const zAspirationVisibility = z
  .object({
    level: z.enum(["public", "players", "gm", "campaign", "user", "private"]),
    scopeId: z.string().nullable().default(null),
  })
  .refine((v) => (v.level === "campaign" || v.level === "user" ? v.scopeId !== null : v.scopeId === null), {
    message: "campaign/user necessitent un scopeId ; les autres niveaux n'en veulent pas.",
  });

const zAspiration = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  horizon: z.enum(["life", "arc", "session"]),
  intensity: z.number().int().min(1).max(3),
  visibility: zAspirationVisibility.default({ level: "public", scopeId: null }),
});

export const zPersonalityBlockData = z.object({
  __v: z.literal(1),
  poles: z.array(zPersonalityPole),
  priority: z.array(z.enum(PERSONALITY_POLE_KEYS)).default([]),
  aspirations: z.array(zAspiration).default([]),
  lines: z.array(z.string().min(1)).default([]),
  limits: z.array(z.string().min(1)).default([]),
  baseline: z
    .object({
      trust: z.number().int().min(-100).max(100),
      affinity: z.number().int().min(-100).max(100),
      respect: z.number().int().min(-100).max(100),
      fear: z.number().int().min(-100).max(100),
    })
    .default({ trust: 0, affinity: 0, respect: 0, fear: 0 }),
  speech: z
    .object({
      register: z.string().default(""),
      tics: z.array(z.string().min(1)).default([]),
    })
    .default({ register: "", tics: [] }),
});
export type PersonalityBlockData = z.infer<typeof zPersonalityBlockData>;
export type PersonalityPole = z.infer<typeof zPersonalityPole>;
export type Aspiration = z.infer<typeof zAspiration>;
