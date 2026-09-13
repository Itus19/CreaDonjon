import { z } from "zod";

/**
 * Entrees de televersement (audit B-05). Les quatre routes multipart du
 * projet validaient leur `FormData` a la main — `typeof x === "string"`,
 * `instanceof File`, un `Set` de niveaux recopie — alors que la regle
 * absolue n° 4 de CLAUDE.md dit "toute entree de route serveur est validee
 * par un schema Zod, aucune exception". Une regle qui en compte cinq n'est
 * plus une regle.
 *
 * Ces schemas reproduisent le comportement existant a l'identique, replis
 * silencieux compris : `visibilityLevel` inconnu retombe sur "public",
 * `maxDimension` illisible est simplement ignore. Le but de ce ticket
 * etait de rendre la validation lisible en un endroit, pas de durcir des
 * entrees au passage — durcir se decide separement, en connaissance de
 * cause.
 */

/** `File` du runtime Web, celui que `formData()` renvoie — jamais un flux Node. */
const zUploadedFile = z.instanceof(File, { message: "Aucun fichier reçu." });

/** Televersement simple : un fichier, rien d'autre (portrait, image de bloc, fond d'ecran). */
export const fileUploadSchema = z.object({
  file: zUploadedFile,
});

/**
 * Televersement d'asset de monde, le seul a porter des options.
 *
 * `visibilityLevel` : meme enumeration que `zVisibilityInput`
 * (lib/visibility/schemas.ts) et que `VisibilityLevel`
 * (src/core/visibility/types.ts). Recopiee ici plutot qu'importee parce
 * que la contrainte de `scopeId` qui accompagne l'autre schema n'a pas
 * cours ici — cette route pose toujours `visibilityScopeId: null`.
 *
 * `maxDimension` : borne, ce que l'ancien code ne faisait pas. `8192`
 * couvre largement les cartes reelles (~5760 px constate) ; en dessous de
 * `64` le redimensionnement ne produirait rien d'utilisable. Une valeur
 * hors bornes est ignoree comme l'etait une valeur illisible, jamais un
 * rejet — c'est un confort d'appel, pas une donnee metier.
 */
export const assetUploadSchema = z.object({
  file: zUploadedFile,
  altText: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .catch(null),
  visibilityLevel: z
    .enum(["public", "players", "gm", "campaign", "user", "private"])
    .catch("public"),
  maxDimension: z.coerce.number().int().min(64).max(8192).optional().catch(undefined),
});

/**
 * Lit un `FormData` comme un objet simple, pour le passer a l'un des
 * schemas ci-dessus. `getAll` n'est jamais utilise : aucune de ces routes
 * n'attend de champ repete.
 */
export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}
