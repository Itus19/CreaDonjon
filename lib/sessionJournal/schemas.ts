import { z } from "zod";
import { zGameDate } from "@/src/core/schemas/calendar";

/** Assigner un devoir (V2.1-3, retour utilisateur : "pouvoir donner le devoir à un joueur") — MJ seulement, RLS-gate. */
export const assignJournalEntrySchema = z.object({
  ingameDate: zGameDate,
  assignedTo: z.uuid(),
});

/** L'autrice commence a rediger : titre libre, jamais vide. */
export const submitJournalEntrySchema = z.object({
  assignmentId: z.uuid(),
  title: z.string().trim().min(1, "Un titre est requis.").max(200, "200 caractères maximum."),
});
