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
//
// `entityKind` : texte libre plutot que `z.enum(ENTITY_KINDS)` (retour
// utilisateur — categorie personnalisee, V2-G7). `entities.entity_kind`
// n'a jamais eu de contrainte CHECK en base (verifie dans les migrations),
// seul ce schema le verrouillait aux 8 valeurs fixes — les desserrer ici
// suffit, aucun changement de schema necessaire.
export const updateEntitySchema = z.object({
  version: z.number().int().positive(),
  name: z.string().trim().max(200, "200 caracteres maximum."),
  entityKind: z.string().trim().min(1, "Choisissez un type.").max(40, "40 caractères maximum."),
  aliases: z.array(z.string()).default([]),
  isPublic: z.boolean(),
});

// Glisser-depose (V2-G9) : copie de reorderBlockSchema (lib/blocks/schemas.ts).
export const reorderEntitySchema = z.object({
  version: z.number().int().positive(),
  displayOrder: z.number(),
});

// Ordre des categories de la sidebar (V2-G9) : tableau complet, remplace a
// chaque glisser-depose plutot qu'un delta — peu d'elements (moins d'une
// vingtaine de categories dans le pire cas), pas besoin d'un ajustement fin.
export const reorderEntityKindsSchema = z.object({
  order: z.array(z.string().trim().min(1)).max(50),
});

// Mise en page du portrait dans le wiki (V2-G11) : taille en % et
// alignement gauche/droite (jamais centre — un flottement centre n'a pas de
// sens en CSS, le texte du premier bloc contourne le portrait a droite ou a
// gauche).
export const portraitLayoutSchema = z.object({
  displaySizePct: z.number().int().min(50).max(200),
  align: z.enum(["left", "right"]),
});

// Nom donne a une fiche vierge (V2-G8, retour utilisateur : un nom vide
// laissait des lignes blanches illisibles dans la barre laterale) — un vrai
// nom persiste des la creation plutot qu'une chaine vide, jamais impose : le
// champ reste modifiable/effaçable comme n'importe quel autre nom.
export const DEFAULT_ENTITY_NAME = "Nouvelle entité";

// Creation a la volee depuis le bloc genealogie (V2-H3) : contrairement a
// createBlankEntitySchema (server action, redirige toujours vers la
// nouvelle fiche), ce chemin JSON cree une entite SANS quitter le bloc —
// le nom est deja connu (tape dans la carte vide), jamais "Nouvelle
// entite" a renommer ensuite.
export const createEntityWithNameSchema = z.object({
  worldId: z.guid(),
  name: z.string().trim().min(1, "Un nom est requis.").max(200, "200 caracteres maximum."),
  entityKind: z.string().trim().min(1).max(40).default("character"),
});

export { ENTITY_KINDS };
