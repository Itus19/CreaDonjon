import { z } from "zod";

/**
 * Lien d'un element de carte (punaise, zone — Lot I, phases C/D) vers une
 * fiche (retour utilisateur : "le lien permet de faire un lien direct avec
 * une fiche existante") — jamais une regle : contrairement a
 * `BlockReference` (src/core/schemas/blocks/reference.ts, partage par les
 * blocs de personnage), un element de carte n'a de sens que pointe sur une
 * ENTITE du wiki. Independant de `label`/`name` (texte libre, toujours
 * affiche que ce lien existe ou non). Partage entre `map_pins` et
 * `map_regions` — jamais deux types distincts pour le meme besoin.
 */
export const zMapElementRef = z.object({ kind: z.literal("entity"), id: z.string().min(1) });
export type MapElementRef = z.infer<typeof zMapElementRef>;
