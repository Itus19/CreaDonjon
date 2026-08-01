import { z } from "zod";

/**
 * Structure des segments narratifs (SCHEMA.md §6, specs/wiki-liens-et-
 * personnages.md §A1). Le contenu est une liste de noeuds types, jamais
 * une chaine balisee ni des decalages : editer un noeud ne touche pas les
 * autres, aucun parsing a l'affichage.
 *
 * V0-06f : les noeuds `em`/`strong`/`code` (exclusifs, un noeud ne pouvait
 * porter qu'un seul style) deviennent des marques combinables sur un noeud
 * texte unique (gras ET italique sur le meme passage, ce que l'ancien
 * modele ne permettait pas). `blockType` distingue paragraphe/titres —
 * c'est un attribut du segment (un segment = un bloc, comme un paragraphe
 * ou un titre dans un editeur de texte riche), pas du contenu inline.
 *
 * V0-06g : `spoiler` est une marque comme les autres, PAS un niveau de
 * visibilite — le texte est bel et bien envoye au client (celui qui le
 * lit y a deja droit), seul l'affichage initial le caviarde jusqu'au clic.
 * Ne remplace jamais `visibility` (la seule chose qui determine ce que le
 * serveur envoie ou non, regle absolue n°4).
 */

export const MARKS = ["bold", "italic", "underline", "strike", "spoiler"] as const;
export type Mark = (typeof MARKS)[number];

const zTextNode = z.object({
  t: z.literal("text"),
  v: z.string(),
  marks: z.array(z.enum(MARKS)).optional(),
});

// kind='rule' cible par cle (survit a la surcharge) ; entity/asset ciblent
// par identifiant. Un seul objet plutot qu'une union discriminee : "t" vaut
// "ref" pour les trois formes, donc le discriminant naturel serait "kind",
// mais garder une forme unique + validation croisee est plus simple a lire.
const zRefNode = z
  .object({
    t: z.literal("ref"),
    kind: z.enum(["entity", "rule", "asset"]),
    id: z.string().optional(),
    key: z.string().optional(),
    label: z.string(),
  })
  .refine((node) => (node.kind === "rule" ? node.key !== undefined : node.id !== undefined), {
    message: "kind='rule' necessite key, entity/asset necessitent id.",
  });

export const zSegmentContentNode = z.union([zTextNode, zRefNode]);
export type SegmentContentNode = z.infer<typeof zSegmentContentNode>;

export const SEGMENT_BLOCK_TYPES = ["paragraph", "h1", "h2", "h3", "h4"] as const;
export type SegmentBlockType = (typeof SEGMENT_BLOCK_TYPES)[number];

export const zSegmentVisibility = z
  .object({
    level: z.enum(["public", "players", "gm", "campaign", "user", "private"]),
    scopeId: z.string().nullable(),
  })
  .refine(
    (v) => (v.level === "campaign" || v.level === "user" ? v.scopeId !== null : v.scopeId === null),
    { message: "campaign/user necessitent un scopeId ; les autres niveaux n'en veulent pas." }
  );
export type SegmentVisibility = z.infer<typeof zSegmentVisibility>;

export const zSegment = z.object({
  id: z.string().min(1),
  blockType: z.enum(SEGMENT_BLOCK_TYPES),
  visibility: zSegmentVisibility,
  content: z.array(zSegmentContentNode).min(1),
});
export type Segment = z.infer<typeof zSegment>;

export const zNarrativeContent = z.array(zSegment);
export type NarrativeContent = z.infer<typeof zNarrativeContent>;
