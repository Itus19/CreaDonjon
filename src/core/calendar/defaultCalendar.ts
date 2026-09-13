import type { CalendarConfig } from "./types";

/**
 * Calendrier neutre tant que le MJ n'a rien regle : douze mois de trente
 * jours, semaine de sept jours, aucune ere. Jamais presente comme "le"
 * calendrier officiel d'un monde — un point de depart generique a renommer
 * (CLAUDE.md, contenu SRD/produit interdit ici : aucun nom de mois emprunte
 * a un calendrier de licence).
 */
/** Décade du calendrier républicain français (retour utilisateur) — dix jours plutôt que sept, un point de départ dépaysant pour un calendrier de jeu plutôt que le calendrier grégorien du quotidien. Domaine public (aboli en 1805, aucune licence). */
const DEFAULT_WEEKDAY_NAMES = ["Primidi", "Duodi", "Tridi", "Quartidi", "Quintidi", "Sextidi", "Septidi", "Octidi", "Nonidi", "Décadi"];

export const DEFAULT_CALENDAR: CalendarConfig = {
  months: Array.from({ length: 12 }, (_, i) => ({ name: `Mois ${i + 1}`, days: 30 })),
  weekdays: DEFAULT_WEEKDAY_NAMES.map((name) => ({ name })),
  eras: [],
  currentDate: null,
};
