import { z } from "zod";

/**
 * Cles de fiches de regle dont l'assistant de creation veut les blocs bruts
 * (description, bases de classe, etc.) — pour un affichage qui reste a jour
 * quand la fiche de regle est editee, plutot qu'un resume fige (`ai_digest`).
 *
 * Plafond releve a 1000 (V2-G1 suite, bug reel trouve en verifiant l'etape
 * Sorts) : la liste complete de sorts d'un monde (339 sur le SRD 2024 seul)
 * depassait largement l'ancien plafond de 50, faisant echouer silencieusement
 * toute la requete groupee — `useRuleEntryBlocks` retombait alors sur une
 * reponse vide pour TOUTES les cles demandees, pas seulement les sorts.
 */
export const ruleEntryBlocksSchema = z.object({
  keys: z.array(z.string().min(1)).max(1000),
});
