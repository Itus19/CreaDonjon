import { z } from "zod";
import { zGameDate } from "@/src/core/schemas/calendar";

/** Assigner un devoir (V2.1-3, retour utilisateur : "pouvoir donner le devoir à un joueur") — MJ seulement, RLS-gate. */
export const assignJournalEntrySchema = z.object({
  ingameDate: zGameDate,
  assignedTo: z.uuid(),
});

/** « Devoir fait » (V3.1-150) : l'autrice rend son devoir. Rien d'autre ne vient du client. */
export const submitJournalAssignmentSchema = z.strictObject({
  assignmentId: z.uuid(),
});
