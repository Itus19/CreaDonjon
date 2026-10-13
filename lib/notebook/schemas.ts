import { z } from "zod";


/** Partager une page, ou ne plus la partager : la ligne du cahier visée. */
export const shareNotebookPageSchema = z.object({ itemId: z.string().min(1).max(100) });
