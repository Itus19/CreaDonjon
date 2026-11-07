export type Tab = "actions" | "magie" | "inventaire" | "traits" | "maitrise";

/** Libelles d'onglet (retour utilisateur, V2-G1) : ecrits ici, jamais deduits de la cle par une classe `capitalize` (par mot), qui rendait "Maitrise D'armes" — sans accent et mal coupe. Partages par la fiche jouable et ses onglets ; un module a part pour eviter un cycle d'import (V3.1-51 ; depuis V3.1-177, l'apercu de l'assistant EST la fiche jouable, en lecture). */
export const TAB_LABELS: Record<Tab, string> = {
  actions: "Actions",
  magie: "Magie",
  inventaire: "Inventaire",
  traits: "Traits",
  maitrise: "Maîtrises",
};
