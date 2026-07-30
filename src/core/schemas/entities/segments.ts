import { z } from "zod";

/**
 * Structure des segments narratifs (SCHEMA.md §6, specs/wiki-liens-et-
 * personnages.md §A1). Le contenu est une liste de noeuds types, jamais
 * une chaine balisee ni des decalages : editer un noeud ne touche pas les
 * autres, aucun parsing a l'affichage.
 */

const zTextNode = z.object({ t: z.literal("text"), v: z.string() });
const zEmNode = z.object({ t: z.literal("em"), v: z.string() });
const zStrongNode = z.object({ t: z.literal("strong"), v: z.string() });
const zCodeNode = z.object({ t: z.literal("code"), v: z.string() });

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

export const zSegmentContentNode = z.union([zTextNode, zEmNode, zStrongNode, zCodeNode, zRefNode]);
export type SegmentContentNode = z.infer<typeof zSegmentContentNode>;

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
  visibility: zSegmentVisibility,
  content: z.array(zSegmentContentNode).min(1),
});
export type Segment = z.infer<typeof zSegment>;

export const zNarrativeContent = z.array(zSegment);
export type NarrativeContent = z.infer<typeof zNarrativeContent>;
