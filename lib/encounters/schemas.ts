import { z } from "zod";

/** Requete du solveur aleatoire (V1-E3, specs/outils-mj.md §4.3) — le budget disponible pour cette bande de difficulte est recalcule cote serveur, jamais transmis par le client. */
export const generateEncounterSchema = z.object({
  partySize: z.number().int().positive().max(20),
  partyLevel: z.number().int().min(1).max(20),
  band: z.enum(["low", "moderate", "high"]),
});

const encounterParticipantSchema = z.object({
  entryKey: z.string().trim().min(1),
  name: z.string().trim().min(1),
  challengeRatingLabel: z.string().trim().min(1),
  xp: z.number().nonnegative(),
  count: z.number().int().positive(),
});

/** Sauvegarde d'une rencontre composee dans "Mes combats" — `participants` est un instantane (nom/FP/PX au moment de la sauvegarde), jamais recalcule depuis le ruleset a la lecture. */
export const saveEncounterSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(200, "200 caractères maximum.").default("Rencontre"),
  partySize: z.number().int().positive().max(20),
  partyLevel: z.number().int().min(1).max(20),
  band: z.enum(["low", "moderate", "high"]).nullable(),
  participants: z.array(encounterParticipantSchema),
});
