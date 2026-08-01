// Libelles francais destines a l'interface. Les identifiants techniques
// (colonnes, cles, types) restent en anglais snake_case (CLAUDE.md, regle
// absolue 11) ; tout le francais visible par l'utilisateur vit ici.

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

/** entry_type des regles (specs/regles-blocs.md, V1-A1) — SCHEMA.md §9. */
export const ENTRY_TYPE_LABELS_FR: Record<string, string> = {
  spell: "Sort",
  item: "Objet",
  weapon: "Arme",
  armor: "Armure",
  class: "Classe",
  subclass: "Sous-classe",
  feature: "Aptitude",
  monster: "Monstre",
  condition: "Condition",
  rule: "Regle",
  background: "Historique",
  species: "Espece",
};

export const fr = { RELATION_LABELS_FR, ENTRY_TYPE_LABELS_FR } as const;
