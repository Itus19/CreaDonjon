import PersonalityRadar from "@/components/entities/psyche/PersonalityRadar";
import PublicSouvenirsTable, { type PublicSouvenirRow } from "./PublicSouvenirsTable";
import { archetypeFor } from "@/src/core/psyche/archetype";
import type { PersonalityPoleKey } from "@/src/core/psyche/keys";
import type { PersonalityBlockData } from "@/src/core/schemas/blocks/personality";
import type { PersonalityEventRow } from "@/src/server/repos/psyche";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { PERSONALITY_POLES_FR } from "@/src/i18n/fr";
import { useTranslations } from "next-intl";
import { poleVise } from "@/lib/ui/psycheBloc";

/** L'effet d'un souvenir pour le lecteur : le côté vers lequel il pousse, jamais un nombre. */
function formatDeltas(deltas: Partial<Record<PersonalityPoleKey, number>>, vers: (pole: string) => string): string {
  return Object.entries(deltas)
    .filter(([key]) => key in PERSONALITY_POLES_FR)
    .map(([key, delta]) => vers(poleVise(PERSONALITY_POLES_FR[key as PersonalityPoleKey], delta!)))
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
  const t = useTranslations("fiche.psyche");
  const archetype = archetypeFor(Object.fromEntries(data.poles.map((p) => [p.key, p.value])));
  const rows: PublicSouvenirRow[] = events.map((event) => ({
    id: event.id,
    summary: event.summary,
    effect: formatDeltas(event.deltas as Partial<Record<PersonalityPoleKey, number>>, (pole) => t("versPole", { pole })),
    occurredAtIngame: event.occurred_at_ingame as unknown as PublicSouvenirRow["occurredAtIngame"],
  }));
  return (
    <div>
      <PersonalityRadar poles={data.poles} archetype={archetype} label={t("radarLabel")} />
      <PublicSouvenirsTable rows={rows} calendar={calendar} />
    </div>
  );
}
