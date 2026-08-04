import { z } from "zod";
import { zBlockReference } from "@/src/core/schemas/blocks/reference";

export const resolveChipsSchema = z.object({
  refs: z.array(zBlockReference).min(1).max(200),
});
