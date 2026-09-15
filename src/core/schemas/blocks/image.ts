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
 *
 * Fond de page wiki (V2-G13) : `useAsWikiBackground` ne change jamais le
 * fond de l'application, seulement celui de la page wiki DE CETTE FICHE
 * (`src/styles/tokens.css`, selecteur `.wiki-bg-scope` — jamais `<html>`).
 * Un seul bloc actif a la fois par fiche, applique cote serveur
 * (`src/server/services/blocks.ts`) : cocher celui-ci decoche
 * silencieusement tout autre bloc image de la meme entite. `backgroundBlurPx`
 * meme plage que le flou de fond personnel existant (0-40, cookie `bgBlur`,
 * `SettingsMenu.tsx`) — mais stocke ici, ce n'est pas une preference du
 * visiteur, c'est un choix de l'auteur qui s'applique a tout le monde.
 * `fadeMs` : duree du fondu d'entree, uniquement pertinent (et affiche)
 * quand `useAsWikiBackground` est coche.
 */
/**
 * Ancrage explicite (V2.1-10) : `wrapMode` ne disait QUE le comportement du
 * texte, et la cible etait implicite — « le bloc suivant ». Trois defauts :
 * l'image restait bloc frere de sa cible (bordure orpheline, image demarrant
 * au-dessus du titre), reordonner les blocs changeait la cible en silence, et
 * aucun reglage ne placait l'image AILLEURS qu'en tete du bloc.
 *
 * `anchor` vise un segment par son `id` (`zSegment`, ../entities/segments),
 * jamais un pourcentage de hauteur : un flottement CSS s'accroche au point du
 * flux ou il est insere, « a 40 % de la hauteur » n'existe pas. L'interface
 * offre donc un curseur a N+1 crans, un par segment.
 *
 * `wrapMode` n'apparait plus dans l'interface mais reste LU : c'est
 * `planImageAnchors` (src/core/images/blockAnchor.ts) qui traduit l'ancien
 * "wrap" en ancrage sur le bloc suivant, a un seul endroit, teste. Aucun bloc
 * existant n'est reecrit en base, d'ou le `__v` inchange.
 */
export const zImageBlockData = z.object({
  __v: z.literal(1),
  url: z.string().default(""),
  caption: z.string().default(""),
  wrapMode: z.enum(["intercalate", "wrap"]).default("intercalate"),
  placement: z.enum(["flow", "anchored"]).default("flow"),
  anchor: z
    .object({
      blockId: z.string().min(1),
      /** `null` = en tete du bloc hote, avant son premier segment. */
      segmentId: z.string().min(1).nullable(),
      /**
       * Cote du segment vise. Existe pour le seul dernier cran du curseur,
       * « a la fin du bloc » : sans lui, aucune position ne suit le dernier
       * segment, et un bloc autonome pose juste apres n'est PAS equivalent —
       * il porte son propre cadre de bloc (bordure, rembourrage).
       */
      position: z.enum(["before", "after"]).default("before"),
    })
    .nullable()
    .default(null),
  anchorFlow: z.enum(["float", "break"]).default("float"),
  align: z.enum(["left", "right", "center"]).default("center"),
  sizePct: z.number().int().min(50).max(200).default(100),
  useAsWikiBackground: z.boolean().default(false),
  /**
   * V2.1-10 lot 2 : n'a de sens qu'avec `useAsWikiBackground`. Le couple
   * forme les trois etats du fond de page — voir `src/core/images/
   * backgroundMode.ts`, qui est le seul endroit ou on les traduit. Defaut
   * `false` : un bloc pose avant ce lot garde son comportement exclusif
   * (image retiree du corps de la fiche), sans migration.
   */
  alsoShowInFlow: z.boolean().default(false),
  backgroundBlurPx: z.number().int().min(0).max(40).default(20),
  fadeMs: z.number().int().min(0).max(3000).default(600),
});
export type ImageBlockData = z.infer<typeof zImageBlockData>;
