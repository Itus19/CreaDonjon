export type Tab = "actions" | "magie" | "inventaire" | "traits" | "maitrise";

/** Libelles d'onglet (retour utilisateur, V2-G1) : ecrits ici, jamais deduits de la cle par une classe `capitalize` (par mot), qui rendait "Maitrise D'armes" — sans accent et mal coupe. Partages entre la fiche jouable et l'apercu de l'assistant de creation (`PreviewStep`) ; un module a part pour ne pas faire un cycle d'import fiche -> assistant -> apercu -> fiche (V3.1-51, la montee de niveau ouvre l'assistant depuis la fiche). */
export const TAB_LABELS: Record<Tab, string> = {
  actions: "Actions",
  magie: "Magie",
  inventaire: "Inventaire",
  traits: "Traits",
  maitrise: "Maîtrises",
};
