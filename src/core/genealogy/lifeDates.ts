import { zGameDate } from "../schemas/calendar";
import { ageAt } from "../calendar/age";
import type { GameDate } from "../calendar/types";

/**
 * Naissance et mort d'une fiche (V3.1-74, ADR 0063), lues dans son bloc
 * `character`. Une fiche sans ce bloc, ou sans ces champs, n'a pas de dates :
 * rien n'est inventé. « Défunt » = `death` renseigné, jamais un booléen à part
 * (règle 16). Lecture tolérante : une date mal formée est ignorée seule.
 */
export interface LifeDates {
  birth?: GameDate;
  death?: GameDate;
}

export function lifeDatesFromCharacter(data: unknown): LifeDates {
  const raw = (data ?? {}) as { birth?: unknown; death?: unknown };
  const birth = zGameDate.safeParse(raw.birth);
  const death = zGameDate.safeParse(raw.death);
  return {
    ...(birth.success ? { birth: birth.data } : {}),
    ...(death.success ? { death: death.data } : {}),
  };
}

/** Âge affiché : à la mort pour un défunt, à la date du jour du monde sinon. Sans naissance, ou sans date de référence : aucun. */
export function ageWithDeath(birth: GameDate | undefined, today: GameDate | null, death: GameDate | undefined): number | undefined {
  if (!birth) return undefined;
  const reference = death ?? today;
  return reference ? ageAt(birth, reference) : undefined;
}
