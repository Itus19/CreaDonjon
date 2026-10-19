/** Formats de date du journal historique (V3.1-61), selon la langue de l'interface. */

export function formaterHeure(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** « 8 oct. » */
export function formaterJourCourt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
}

/** « 8 oct. 10:42 » */
export function formaterQuand(iso: string, locale: string): string {
  return `${formaterJourCourt(iso, locale)} ${formaterHeure(iso, locale)}`;
}

/** « mercredi 8 octobre » */
export function formaterJourLong(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}
