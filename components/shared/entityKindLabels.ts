import { ENTITY_KINDS } from "@/lib/entities/schemas";

export const ENTITY_KIND_LABELS: Record<(typeof ENTITY_KINDS)[number], string> = {
  character: "Personnage",
  location: "Lieu",
  faction: "Faction",
  item: "Objet",
  creature: "Créature",
  quest: "Quête",
  event: "Événement",
  other: "Autre",
};
