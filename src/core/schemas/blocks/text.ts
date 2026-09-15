import { z } from "zod";
import { zNarrativeContent } from "../entities/segments";

/**
 * Bloc `text` (layout: prose, specs/wiki-blocs.md §1, renomme depuis
 * `description` en V0-06e) : memes segments narratifs porteurs de
 * visibilite que l'ancien `entities.narrative_content`. Le type ne
 * presuppose plus un role — c'est le titre libre du bloc (« Description »,
 * « Histoire », « Resume »...) qui porte le sens, pas le type technique.
 *
 * V2.1-14 : `dropCap` (lettrine sur le premier paragraphe) est une propriete
 * du BLOC, pas d'un segment — un seul paragraphe est concerne, toujours le
 * premier, et le choix vaut pour le bloc entier. Remplace le CSS reserve aux
 * fiches `session_journal` (`.journal-entry`, retire au meme ticket) : une
 * lettrine est de la mise en forme, jamais la propriete d'un genre de fiche.
 * Champ optionnel a defaut `false` — tout le contenu anterieur reste valide
 * sans migration, d'ou un `__v` inchange.
 */
export const zTextBlockData = z.object({
  __v: z.literal(1),
  segments: zNarrativeContent,
  dropCap: z.boolean().default(false),
});
export type TextBlockData = z.infer<typeof zTextBlockData>;
