import type { CalendarConfig } from "./types";

/**
 * Calendrier neutre tant que le MJ n'a rien regle : douze mois de trente
 * jours, semaine de sept jours, aucune ere. Jamais presente comme "le"
 * calendrier officiel d'un monde — un point de depart generique a renommer
 * (CLAUDE.md, contenu SRD/produit interdit ici : aucun nom de mois emprunte
 * a un calendrier de licence).
 */
export const DEFAULT_CALENDAR: CalendarConfig = {
  months: Array.from({ length: 12 }, (_, i) => ({ name: `Mois ${i + 1}`, days: 30 })),
  daysPerWeek: 7,
  eras: [],
};
