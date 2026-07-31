/**
 * Vocabulaire ferme des relations (SCHEMA.md §8, meme liste que la
 * contrainte check de la table `relations`). Un type ajoute ici doit
 * d'abord etre ajoute a la contrainte SQL par une nouvelle migration.
 */
export const RELATION_TYPES = [
  "parent_of",
  "sibling_of",
  "married_to",
  "adopted_by",
  "ancestor_of",
  "friend_of",
  "rival_of",
  "mentor_of",
  "serves",
  "member_of",
  "leads",
  "part_of",
  "located_in",
  "origin_of",
  "owns",
  "created",
  "carries",
  "knows",
  "loves",
  "hates",
  "participated_in",
  "witnessed",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/**
 * Inverse d'affichage (SCHEMA.md §8) : "une seule ligne stockee, deux sens
 * navigables". Ce n'est jamais une valeur ecrite en base — seulement le
 * libelle utilise quand on regarde la relation depuis l'entite cible.
 */
const INVERSE: Record<RelationType, string> = {
  parent_of: "child_of",
  sibling_of: "sibling_of",
  married_to: "married_to",
  adopted_by: "adopted",
  ancestor_of: "descendant_of",
  friend_of: "friend_of",
  rival_of: "rival_of",
  mentor_of: "apprentice_of",
  serves: "served_by",
  member_of: "has_member",
  leads: "led_by",
  part_of: "contains",
  located_in: "contains",
  origin_of: "originates_from",
  owns: "owned_by",
  created: "created_by",
  carries: "carried_by",
  knows: "knows",
  loves: "loved_by",
  hates: "hated_by",
  participated_in: "had_participant",
  witnessed: "witnessed_by",
};

/** Libelle a afficher pour une relation, selon le sens dans lequel on la regarde. */
export function relationLabel(relationType: RelationType, direction: "out" | "in"): string {
  return direction === "out" ? relationType : INVERSE[relationType];
}
