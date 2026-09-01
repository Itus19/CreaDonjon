import { z } from "zod";

/** Taille d'affichage d'une punaise (Lot I, phase C) — jamais un nombre libre, une icone doit rester lisible a un nombre borne de tailles. */
export const zMapPinSize = z.enum(["small", "medium", "large"]);
export type MapPinSize = z.infer<typeof zMapPinSize>;

/**
 * Lien d'une punaise vers une fiche (Lot I, phase C, retour utilisateur :
 * "le lien permet de faire un lien direct avec une fiche existante") —
 * jamais une regle : contrairement a `BlockReference`
 * (src/core/schemas/blocks/reference.ts, partage par les blocs de
 * personnage), une punaise n'a de sens que pointee sur une ENTITE du wiki.
 * Independant de `label` (texte libre, toujours affiche que ce lien existe
 * ou non).
 */
export const zMapPinRef = z.object({ kind: z.literal("entity"), id: z.string().min(1) });
export type MapPinRef = z.infer<typeof zMapPinRef>;
