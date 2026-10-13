import { z } from "zod";

/** V3.1-41 — l'adresse des routes du cahier : un monde, par son slug. */
export const notebookRouteParamsSchema = z.object({ worldSlug: z.string().min(1).max(200) });

/** Partager une page, ou ne plus la partager : la ligne du cahier visée. */
export const shareNotebookPageSchema = z.object({ itemId: z.string().min(1).max(100) });
