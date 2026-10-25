import WorldviewRadar from "@/components/entities/psyche/WorldviewRadar";
import PublicSouvenirsTable, { type PublicSouvenirRow } from "./PublicSouvenirsTable";
import { type WorldviewPoleKey } from "@/src/core/psyche/keys";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { PersonalityEventRow } from "@/src/server/repos/psyche";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { WORLDVIEW_POLES_FR } from "@/src/i18n/fr";
import { useTranslations } from "next-intl";
import { poleVise } from "@/lib/ui/psycheBloc";

/** L'effet d'un souvenir pour le lecteur : le côté vers lequel il pousse, jamais un nombre. */
function formatDeltas(deltas: Partial<Record<WorldviewPoleKey, number>>, vers: (pole: string) => string): string {
  return Object.entries(deltas)
    .filter(([key]) => key in WORLDVIEW_POLES_FR)
    .map(([key, delta]) => vers(poleVise(WORLDVIEW_POLES_FR[key as WorldviewPoleKey], delta!)))
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
  const t = useTranslations("fiche.psyche");
  const rows: PublicSouvenirRow[] = events.map((event) => ({
    id: event.id,
    summary: event.summary,
    effect: formatDeltas(event.deltas as Partial<Record<WorldviewPoleKey, number>>, (pole) => t("versPole", { pole })),
    occurredAtIngame: event.occurred_at_ingame as unknown as PublicSouvenirRow["occurredAtIngame"],
  }));
  return (
    <div>
      <WorldviewRadar poles={data.poles} label={t("radarLabelConvictions")} />
      <PublicSouvenirsTable rows={rows} calendar={calendar} />
    </div>
  );
}
