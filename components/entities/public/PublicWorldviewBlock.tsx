import WorldviewRadar from "@/components/entities/psyche/WorldviewRadar";
import PublicSouvenirsTable, { type PublicSouvenirRow } from "./PublicSouvenirsTable";
import { type WorldviewPoleKey } from "@/src/core/psyche/keys";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { PersonalityEventRow } from "@/src/server/repos/psyche";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

const POLE_LABELS_FR: Record<WorldviewPoleKey, string> = {
  order_freedom: "Ordre",
  mercy_justice: "Miséricorde",
  sacred_profane: "Sacré",
  tradition_progress: "Tradition",
  individual_collective: "Individu",
  wealth_honor: "Richesse",
  peace_force: "Paix",
};

function formatDeltas(deltas: Partial<Record<WorldviewPoleKey, number>>): string {
  return Object.entries(deltas)
    .map(([key, delta]) => `${POLE_LABELS_FR[key as WorldviewPoleKey] ?? key} ${delta! > 0 ? "+" : ""}${delta}`)
    .join(", ");
}

/** Rendu public du bloc `worldview` (V2-H2, "juste la partie des schemas") — le radar, plus (V2, retour utilisateur point 5) un tableau de souvenirs deja filtre par `is_public`. */
export default function PublicWorldviewBlock({
  data,
  events,
  calendar,
}: {
  data: WorldviewBlockData;
  events: PersonalityEventRow[];
  calendar: CalendarConfigInput | null;
}) {
  const rows: PublicSouvenirRow[] = events.map((event) => ({
    id: event.id,
    summary: event.summary,
    effect: formatDeltas(event.deltas as Partial<Record<WorldviewPoleKey, number>>),
    occurredAtIngame: event.occurred_at_ingame as unknown as PublicSouvenirRow["occurredAtIngame"],
  }));
  return (
    <div>
      <WorldviewRadar poles={data.poles} />
      <PublicSouvenirsTable rows={rows} calendar={calendar} />
    </div>
  );
}
