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

// z.guid() (forme generique 8-4-4-4-12) plutot que z.uuid() (qui exige la
// conformite stricte RFC4122 v4 : version et variant nibbles) — les
// identifiants du jeu de demonstration (scripts/seed-dev.ts) sont des uuid
// Postgres valides mais pas des v4 "vrais", et seraient rejetes.
export const createBlankEntitySchema = z.object({
  worldId: z.guid(),
});

// Contrairement a createBlankEntitySchema (FormData d'une server action),
// la mise a jour passe par un appel fetch en JSON vers une route API —
// pour pouvoir renvoyer un vrai code 409 en cas de conflit de version, ce
// qu'une server action ne permet pas nativement.
//
// Pas de longueur minimale sur `name` (V0-06g) : la fiche est editable en
// place des sa creation, sans ecran separe ni nom impose au prealable —
// exiger un nom bloquerait par exemple un changement de type avant que
// l'auteur ait pense a nommer sa fiche.
export const updateEntitySchema = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().max(200, "200 caracteres maximum."),
  entityKind: z.enum(ENTITY_KINDS),
  aliases: z.array(z.string()).default([]),
});

export { ENTITY_KINDS };
