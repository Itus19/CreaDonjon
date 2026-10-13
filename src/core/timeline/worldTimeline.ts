import type { GameDate } from "../calendar/types";
import type { TimelineEntry, TimelineEntryKind, TimelineScope } from "../schemas/blocks/timeline";

/**
 * La Chronologie du monde (V3.1-96, ADR 0048). Fonctions pures : le service
 * `getWorldTimeline` agrège, ce module tranche la portée et fabrique les
 * entrées de naissance et de mort.
 */

/** Genre de la fiche système qui porte les événements ajoutés directement à la frise générale (une par monde). */
export const WORLD_TIMELINE_KIND = "world_timeline";
export const WORLD_TIMELINE_ENTITY_NAME = "Chronologie du monde";

const SCOPE_BY_KIND: Partial<Record<TimelineEntryKind, TimelineScope>> = {
  war: "major",
  disaster: "major",
  founding: "major",
  battle: "notable",
  discovery: "notable",
  oath: "notable",
  betrayal: "notable",
};

/** Portée par défaut d'un genre. Ce que l'ADR ne classe pas (trauma, personnalisé) reste un détail : la frise ne le met jamais en avant sans qu'on le choisisse. */
export function defaultScopeForKind(kind: TimelineEntryKind): TimelineScope {
  return SCOPE_BY_KIND[kind] ?? "detail";
}

/** La portée choisie, sinon le défaut du genre. */
export function resolveScope(entry: Pick<TimelineEntry, "kind" | "scope">): TimelineScope {
  return entry.scope ?? defaultScopeForKind(entry.kind);
}

/** « de » ou « d' » devant un nom (voyelle, h muet compris par défaut). */
function de(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(name.trim()) ? `d'${name.trim()}` : `de ${name.trim()}`;
}

/**
 * Naissance et mort d'une fiche (V3.1-74) en entrées de frise : portée
 * `detail`, visibilité du bloc `character` qui les porte (le service ne les
 * crée que pour un bloc que le lecteur voit).
 */
export function lifeEventEntries(params: {
  entityId: string;
  name: string;
  birth?: GameDate;
  death?: GameDate;
  visibility: TimelineEntry["visibility"];
}): TimelineEntry[] {
  const make = (kind: "birth" | "death", date: GameDate): TimelineEntry => ({
    id: `${kind}:${params.entityId}`,
    date,
    kind,
    title: `${kind === "birth" ? "Naissance" : "Mort"} ${de(params.name)}`,
    summary: "",
    visibility: params.visibility,
    scope: "detail",
  });
  return [...(params.birth ? [make("birth", params.birth)] : []), ...(params.death ? [make("death", params.death)] : [])];
}
