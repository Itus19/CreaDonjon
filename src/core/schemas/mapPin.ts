import { z } from "zod";

/** Taille d'affichage d'une punaise (Lot I, phase C) — jamais un nombre libre, une icone doit rester lisible a un nombre borne de tailles. */
export const zMapPinSize = z.enum(["small", "medium", "large"]);
export type MapPinSize = z.infer<typeof zMapPinSize>;
