import { ENTITY_KINDS } from "@/lib/entities/schemas";
import { SHARED_NOTE_KIND } from "@/src/core/notebook/share";
import { WORLD_TIMELINE_KIND } from "@/src/core/timeline/worldTimeline";

export const ENTITY_KIND_LABELS: Record<(typeof ENTITY_KINDS)[number], string> = {
  character: "Personnage",
  location: "Lieu",
  faction: "Faction",
  item: "Objet",
  creature: "Créature",
  quest: "Quête",
  event: "Événement",
  carte: "Carte",
  generateur: "Générateur",
  session_prep: "Préparation de séance",
  other: "Autre",
};

/**
 * Les types système : jamais proposés à la création, mais une fiche qui en
 * porte un (une entrée du Livre de sessions, une page partagée du cahier, la
 * Chronologie du monde) l'affiche dans le menu de son type — en français,
 * pas sous sa valeur technique.
 */
export const SYSTEM_KIND_LABELS: Record<string, string> = {
  session_journal: "Livre de sessions",
  [SHARED_NOTE_KIND]: "Page partagée",
  [WORLD_TIMELINE_KIND]: "Chronologie du monde",
};
