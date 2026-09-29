import { z } from "zod";

const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ).");
const zTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (HH:MM).");

/** Une seule plage par jour (retour utilisateur, V2.1-4) — poser une nouvelle plage remplace l'ancienne du même jour. */
export const setAvailabilitySchema = z
  .object({ date: zDate, startsAt: zTime, endsAt: zTime })
  .refine((v) => v.endsAt > v.startsAt, { message: "L'heure de fin doit être après l'heure de début.", path: ["endsAt"] });

export const clearAvailabilitySchema = z.object({ date: zDate });

/**
 * Confirmer une séance (V2.1-4) — `source: "availability"` vient d'un jour
 * du classement (horaire/durée déjà calculés côté serveur, l'appelant les
 * recopie tels quels) ; `source: "manual"` est le réglage manuel du MJ
 * (retour utilisateur : "sans passer par l'outil") — même écriture dans
 * les deux cas, seule l'étiquette affichée diffère.
 */
export const createRealSessionSchema = z.object({
  date: zDate,
  startsAt: zTime,
  durationMinutes: z.number().int().positive().max(24 * 60),
  source: z.enum(["availability", "manual"]),
});

export const targetDurationSchema = z.object({ minutes: z.number().int().min(30).max(24 * 60) });

/**
 * Ouvrir une ronde de demande (V3.1-8) — `title` vide/absent est généré
 * côté service (`openAvailabilityRequest`), jamais ici : ce schéma ne fait
 * que valider la forme, pas la logique métier. Au moins une date
 * candidate — une ronde sans aucune date candidate n'aurait rien à
 * proposer.
 */
export const openAvailabilityRequestSchema = z
  .object({
    title: z.string().max(120).optional(),
    candidateDates: z.array(zDate).min(1, "Choisis au moins une date candidate."),
    startsAt: zTime,
    endsAt: zTime,
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "L'heure de fin doit être après l'heure de début.", path: ["endsAt"] });
