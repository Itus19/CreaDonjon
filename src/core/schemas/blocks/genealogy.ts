import { z } from "zod";

/**
 * Bloc `genealogy` (V2-H3, specs/wiki-blocs.md §2) : ne stocke aucun lien
 * de parente — les liens vivent dans `relations` (docs/SCHEMA.md §8), deja
 * bidirectionnels et visibles/filtrables. Ce bloc ne stocke que la facon
 * de les regarder : depuis quelle entite (racine, souvent l'entite hote
 * elle-meme — `rootEntityId: null` le signifie) et jusqu'a quelle
 * profondeur d'ancetres/descendants.
 *
 * Ajouter un parent depuis ce bloc cree une relation (meme route que
 * `RelationsChips.tsx`) — tous les blocs genealogie qui incluent cette
 * personne se mettent a jour, comme la section « Relations » en tete de
 * fiche. Une seule source de verite, jamais un arbre saisi a part.
 */
export const zGenealogyBlockData = z.object({
  __v: z.literal(1),
  rootEntityId: z.string().nullable().default(null),
  depthUp: z.number().int().min(0).max(4).default(2),
  depthDown: z.number().int().min(0).max(4).default(2),
});
export type GenealogyBlockData = z.infer<typeof zGenealogyBlockData>;
