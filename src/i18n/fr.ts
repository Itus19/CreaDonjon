// Libelles francais destines a l'interface. Les identifiants techniques
// (colonnes, cles, types) restent en anglais snake_case (CLAUDE.md, regle
// absolue 11).
//
// V1-A1b : les libelles bilingues (coquille, types d'entree de regles)
// vivent desormais dans messages/fr.json et messages/en.json (next-intl).
// Ce fichier ne porte plus que ce qui n'a pas encore ete migre —
// RELATION_LABELS_FR reste francais uniquement pour l'instant, suivi a
// part (pas dans le perimetre de ce ticket).

export const RELATION_LABELS_FR: Record<string, string> = {
  parent_of: "parent de",
  child_of: "enfant de",
  sibling_of: "frere/sœur de",
  married_to: "marie(e) a",
  adopted_by: "adopte(e) par",
  adopted: "a adopte",
  ancestor_of: "ancetre de",
  descendant_of: "descendant(e) de",
  friend_of: "ami(e) de",
  rival_of: "rival(e) de",
  mentor_of: "mentor de",
  apprentice_of: "apprenti(e) de",
  serves: "sert",
  served_by: "servi(e) par",
  member_of: "membre de",
  has_member: "a pour membre",
  leads: "dirige",
  led_by: "dirige(e) par",
  part_of: "fait partie de",
  located_in: "situe(e) dans",
  contains: "contient",
  origin_of: "origine de",
  originates_from: "originaire de",
  owns: "possede",
  owned_by: "possede(e) par",
  created: "a cree",
  created_by: "cree(e) par",
  carries: "porte",
  carried_by: "porte(e) par",
  knows: "connait",
  loves: "aime",
  loved_by: "aime(e) par",
  hates: "deteste",
  hated_by: "deteste(e) par",
  participated_in: "a participe a",
  had_participant: "avec la participation de",
  witnessed: "a assiste a",
  witnessed_by: "vu par",
};

export const fr = { RELATION_LABELS_FR } as const;
