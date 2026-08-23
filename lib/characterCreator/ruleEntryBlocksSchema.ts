import { z } from "zod";

/**
 * Cles de fiches de regle dont l'assistant de creation veut les blocs bruts
 * (description, bases de classe, etc.) — pour un affichage qui reste a jour
 * quand la fiche de regle est editee, plutot qu'un resume fige (`ai_digest`).
 */
export const ruleEntryBlocksSchema = z.object({
  keys: z.array(z.string().min(1)).max(50),
});
