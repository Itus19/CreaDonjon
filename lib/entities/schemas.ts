import { z } from "zod";

const ENTITY_KINDS = [
  "character",
  "location",
  "faction",
  "item",
  "creature",
  "quest",
  "event",
  "other",
] as const;

const commaSeparatedList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );

export const createEntitySchema = z.object({
  // z.guid() (forme generique 8-4-4-4-12) plutot que z.uuid() (qui exige
  // la conformite stricte RFC4122 v4 : version et variant nibbles) — les
  // identifiants du jeu de demonstration (scripts/seed-dev.ts) sont des
  // uuid Postgres valides mais pas des v4 "vrais", et seraient rejetes.
  worldId: z.guid(),
  name: z.string().trim().min(1, "Le nom est requis.").max(200, "200 caracteres maximum."),
  entityKind: z.enum(ENTITY_KINDS),
  aliases: commaSeparatedList,
});

// Contrairement a createEntitySchema (FormData d'une server action), la
// mise a jour passe par un appel fetch en JSON vers une route API — pour
// pouvoir renvoyer un vrai code 409 en cas de conflit de version, ce
// qu'une server action ne permet pas nativement. Le corps est donc deja
// structure, pas des chaines a transformer.
export const updateEntitySchema = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().min(1, "Le nom est requis.").max(200, "200 caracteres maximum."),
  entityKind: z.enum(ENTITY_KINDS),
  aliases: z.array(z.string()).default([]),
});

export { ENTITY_KINDS };
