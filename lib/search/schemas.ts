import { z } from "zod";

export const searchQuerySchema = z.object({
  worldId: z.guid(),
  q: z.string().trim().min(1, "La recherche est vide.").max(200, "200 caracteres maximum."),
});
