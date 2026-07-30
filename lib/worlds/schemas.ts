import { z } from "zod";

export const createWorldSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(100, "100 caracteres maximum."),
});
