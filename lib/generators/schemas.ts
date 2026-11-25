import { z } from "zod";
import { zOfferPrice } from "@/src/core/schemas/blocks/priceList";
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
      /** Texte tire par emplacement (cle du `GeneratorSlot`) — necessaire aux sections promues en bloc structure (personality/quest), qui ont besoin de CHAQUE valeur separement plutot que du texte de section assemble. */
      slots: z.record(z.string(), z.string()).default({}),
      /** V3.2-9 : les emplacements a prix structure (Menu de la Taverne), pour la section promue en bloc « Carte et tarifs ». */
      pricedSlots: z
        .array(
          z.object({
            key: z.string().min(1).max(80),
            text: z.string().max(500),
            price: zOfferPrice.optional(),
            items: z.array(z.object({ text: z.string().max(200), price: zOfferPrice.optional() })).max(30).optional(),
          })
        )
        .max(40)
        .default([]),
    })
  ),
  /** Cle d'entree de regle `monster` choisie a la main par le MJ (V2-J-PNJ) — jamais tiree au hasard, une CR mal choisie casserait l'equilibre. */
  creatureEntryKey: z.string().optional(),
});
