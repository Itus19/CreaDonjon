/**
 * La saison (specs/meteo.md §4) : où en est l'année, de 0 (cœur de
 * l'hiver) à 0,5 (cœur de l'été). Le calendrier du monde donne le jour de
 * l'année ; la latitude donne l'hémisphère.
 */

export const SEASONS = ["winter", "spring", "summer", "autumn"] as const;
export type Season = (typeof SEASONS)[number];

export function yearPhase(params: { dayOfYear: number; yearLength: number; latitude: number; midwinterDay?: number }): number {
  const { dayOfYear, yearLength, latitude } = params;
  if (!Number.isFinite(yearLength) || yearLength <= 0) throw new RangeError("Une année doit compter au moins un jour");
  const midwinter = params.midwinterDay ?? 1;
  const north = (dayOfYear - midwinter) / yearLength;
  const phase = latitude < 0 ? north + 0.5 : north;
  return phase - Math.floor(phase);
}

/** Quatre saisons centrées sur les solstices et les équinoxes. */
export function seasonOf(phase: number): Season {
  const p = phase - Math.floor(phase);
  if (p < 0.125 || p >= 0.875) return "winter";
  if (p < 0.375) return "spring";
  if (p < 0.625) return "summer";
  return "autumn";
}

/** Les saisons en mots, pour l'écran comme pour le modèle. */
export const SEASON_LABELS_FR: Record<Season, string> = { winter: "hiver", spring: "printemps", summer: "été", autumn: "automne" };

/**
 * V3.2-59 (ADR 0120) — La date du bandeau suivie de la saison :
 * « jeudi 14 brumaire 1247, automne ». Sans date du jour, la saison seule (la
 * météo la connaît par la phase de l'année) ; sans l'une ni l'autre, rien.
 */
export function dateWithSeason(dateLabel: string | null, season: Season | null): string | null {
  const saison = season ? SEASON_LABELS_FR[season] : null;
  if (dateLabel && saison) return `${dateLabel}, ${saison}`;
  return dateLabel ?? saison;
}
