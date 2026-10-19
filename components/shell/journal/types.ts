import type { JournalEntry } from "@/src/server/services/activityJournal";

/** Une entrée du journal avec son rang d'arrivée (clé stable pour déplier une ligne). */
export type EntreeJournal = JournalEntry & { id: number };
