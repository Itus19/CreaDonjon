import { z } from "zod";
import { zBlockReference } from "@/src/core/schemas/blocks/reference";

/**
 * Promotion d'un resultat de generateur en fiche (V2-J2) — le serveur
 * reste sans etat pour le tirage (meme discipline que `drawGeneratorSchema`,
 * onlySlotKey), donc le client renvoie ici les valeurs deja tirees de
 * CHAQUE section actuellement affichee dans l'outil (texte + references
 * accumulees). Cle = `sectionKey` (`GeneratorToolSectionConfig.key`,
 * src/core/generators/tools.ts).
 */
export const promoteGeneratorResultSchema = z.object({
  sections: z.record(
    z.string(),
    z.object({
      text: z.string(),
      refs: z.array(zBlockReference).default([]),
    })
  ),
});
