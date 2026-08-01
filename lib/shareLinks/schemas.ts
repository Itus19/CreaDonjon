import { z } from "zod";

export const createShareLinkSchema = z.object({
  worldId: z.guid(),
});

export const revokeShareLinkSchema = z.object({
  id: z.guid(),
  worldId: z.guid(),
});
