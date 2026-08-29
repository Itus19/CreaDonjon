import PersonalityRadar from "@/components/entities/psyche/PersonalityRadar";
import PublicSouvenirsTable, { type PublicSouvenirRow } from "./PublicSouvenirsTable";
import { archetypeFor } from "@/src/core/psyche/archetype";
import type { PersonalityPoleKey } from "@/src/core/psyche/keys";
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import type { PersonalityEventRow } from "@/src/server/repos/psyche";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

const POLE_LABELS_FR: Record<PersonalityPoleKey, string> = {
  curiosity_caution: "Curiosité",
  altruism_selfishness: "Altruisme",
  empathy_hardness: "Empathie",
  impulse_prudence: "Impulsivité",
  extraversion_reserve: "Extraversion",
  authority_independence: "Autorité",
};

function formatDeltas(deltas: Partial<Record<PersonalityPoleKey, number>>): string {
  return Object.entries(deltas)
    .map(([key, delta]) => `${POLE_LABELS_FR[key as PersonalityPoleKey] ?? key} ${delta! > 0 ? "+" : ""}${delta}`)
    .join(", ");
}

/**
 * Rendu public du bloc `personality` (V2-H2, "juste la partie des
 * schemas") — le radar, plus (V2, retour utilisateur point 5) un tableau
 * de souvenirs deja filtre par `is_public` cote serveur. Jamais les
 * curseurs ni les aspirations/lignes rouges/limites : outils d'edition et
 * de suivi MJ, pas un schema a montrer.
 */
export default function PublicPersonalityBlock({
  data,
  events,
  calendar,
}: {
  data: PersonalityBlockData;
  events: PersonalityEventRow[];
  calendar: CalendarConfigInput | null;
}) {
  const archetype = archetypeFor(Object.fromEntries(data.poles.map((p) => [p.key, p.value])));
  const rows: PublicSouvenirRow[] = events.map((event) => ({
    id: event.id,
    summary: event.summary,
    effect: formatDeltas(event.deltas as Partial<Record<PersonalityPoleKey, number>>),
    occurredAtIngame: event.occurred_at_ingame as unknown as PublicSouvenirRow["occurredAtIngame"],
  }));
  return (
    <div>
      <PersonalityRadar poles={data.poles} archetype={archetype} />
      <PublicSouvenirsTable rows={rows} calendar={calendar} />
    </div>
  );
}
