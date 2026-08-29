import { formatGameDate, eraNameFor } from "@/src/core/calendar/formatDate";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { TimelineEntryKind } from "@/src/core/schemas/blocks/timeline";
import type { WorldTimelineEntry } from "@/src/server/services/timeline";

const KIND_LABELS_FR: Record<TimelineEntryKind, string> = {
  birth: "Naissance",
  death: "Mort",
  war: "Guerre",
  battle: "Bataille",
  founding: "Fondation",
  discovery: "Découverte",
  meeting: "Rencontre",
  oath: "Serment",
  betrayal: "Trahison",
  trauma: "Traumatisme",
  disaster: "Catastrophe",
  custom: "Autre",
};

function groupByEra(
  entries: WorldTimelineEntry[],
  calendar: CalendarConfigInput
): { label: string | null; items: WorldTimelineEntry[] }[] {
  if (calendar.eras.length === 0) return [{ label: null, items: entries }];
  const groups: { label: string | null; items: WorldTimelineEntry[] }[] = [];
  for (const item of entries) {
    const era = eraNameFor(calendar, item.entry.date.year);
    const last = groups[groups.length - 1];
    if (last && last.label === era) {
      last.items.push(item);
    } else {
      groups.push({ label: era, items: [item] });
    }
  }
  return groups;
}

/**
 * Vue générale de la chronologie du monde (V2-H2 phase 2) — agrégation déjà
 * faite côté serveur (`getWorldTimeline`), ce composant n'affiche que le
 * résultat, regroupé par ère quand le calendrier du monde en définit.
 */
export default function WorldTimelineView({
  worldSlug,
  entries,
  calendar,
}: {
  worldSlug: string;
  entries: WorldTimelineEntry[];
  calendar: CalendarConfigInput;
}) {
  const groups = groupByEra(entries, calendar);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Chronologie</h1>
        <p className="text-sm text-ink-muted">
          Toutes les entrées visibles de toutes les chronologies du monde, triées dans l&apos;ordre.
        </p>
      </div>

      {entries.length === 0 && (
        <p className="text-sm italic text-ink-muted">
          Aucun événement pour l&apos;instant — ajoutez un bloc « Chronologie » à une fiche pour commencer.
        </p>
      )}

      {groups.map((group, i) => (
        <div key={i} className="flex flex-col gap-2">
          {group.label && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{group.label}</h2>
          )}
          <div className="flex flex-col gap-2">
            {group.items.map(({ entry, sourceEntityId, sourceEntityName, sourceEntitySlug, refEntitySlug }, j) => {
              return (
                <div key={`${sourceEntityId}-${j}`} className="flex flex-col gap-1 rounded border border-edge p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
                      {KIND_LABELS_FR[entry.kind]}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">{formatGameDate(entry.date, calendar)}</span>
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    {refEntitySlug ? (
                      <a href={`/m/${worldSlug}/f/${refEntitySlug}`} className="hover:underline">
                        {entry.title}
                      </a>
                    ) : (
                      entry.title
                    )}
                  </p>
                  {entry.summary && <p className="text-sm text-ink-soft">{entry.summary}</p>}
                  <a href={`/m/${worldSlug}/f/${sourceEntitySlug}`} className="text-xs text-ink-muted hover:underline">
                    Depuis la fiche de {sourceEntityName}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
