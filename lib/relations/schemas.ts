import { z } from "zod";
import { RELATION_TYPES } from "@/src/core/relations/inverses";
import { zVisibilityInput } from "@/lib/visibility/schemas";

export const createRelationSchema = z.object({
  targetEntityId: z.guid(),
  relationType: z.enum(RELATION_TYPES),
  visibility: zVisibilityInput,
});
