import { z } from "zod";

/**
 * Bloc `image` (layout: image, specs/wiki-blocs.md §1, renomme depuis
 * `gallery` en V0-06e — le multi-image n'a jamais servi en pratique) : une
 * seule image, avec une legende optionnelle en dessous. `url` accepte une
 * adresse externe collee OU l'URL servie par le stockage televerse
 * (`GET /api/blocks/[id]/image`, V2-G12) — le rendu ne distingue jamais les
 * deux, meme champ dans les deux cas.
 *
 * Mise en page (V2-G12, retour utilisateur — comportement de traitement de
 * texte) : `wrapMode` distingue "intercalate" (l'image reste un bloc a part
 * entiere, pleine largeur — comportement d'origine) de "wrap" (le texte du
 * bloc suivant contourne l'image, jamais plus d'un bloc). `align` ne
 * propose gauche/droite que pertinent pour "wrap" (un flottement centre
 * n'existe pas en CSS) ; en "intercalate", les trois valeurs positionnent
 * simplement l'image dans son propre bloc. `sizePct` : meme echelle que le
 * portrait (`entity_portraits.display_size_pct`), 50-200%.
 */
export const zImageBlockData = z.object({
  __v: z.literal(1),
  url: z.string().default(""),
  caption: z.string().default(""),
  wrapMode: z.enum(["intercalate", "wrap"]).default("intercalate"),
  align: z.enum(["left", "right", "center"]).default("center"),
  sizePct: z.number().int().min(50).max(200).default(100),
});
export type ImageBlockData = z.infer<typeof zImageBlockData>;
