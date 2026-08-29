import Link from "next/link";
import RelationshipRadar from "@/components/entities/psyche/RelationshipRadar";
import PublicSouvenirsTable, { type PublicSouvenirRow } from "./PublicSouvenirsTable";
import { type RelationshipAxisKey } from "@/src/core/psyche/keys";
import type { AttitudeEventRow } from "@/src/server/repos/psyche";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";

const AXIS_LABELS_FR: Record<RelationshipAxisKey, string> = {
  trust_distrust: "Confiance",
  friendship_hostility: "Amitié",
  respect_contempt: "Respect",
  attraction_repulsion: "Attirance",
  debt_independence: "Dette",
  fear_assurance: "Peur",
  interest_indifference: "Intérêt",
};

function formatDeltas(deltas: Partial<Record<RelationshipAxisKey, number>>): string {
  return Object.entries(deltas)
    .map(([key, delta]) => `${AXIS_LABELS_FR[key as RelationshipAxisKey] ?? key} ${delta! > 0 ? "+" : ""}${delta}`)
    .join(", ");
}

/**
 * Rendu public du bloc `relationship` (V2-H2, "juste la partie des
 * schemas") — le radar seul, plus la cible (indispensable pour lire un
 * radar dont le sujet n'est jamais l'entite hote elle-meme), plus (V2,
 * retour utilisateur point 5) un tableau de souvenirs deja filtre par
 * `is_public`. Jamais les curseurs. Coloration neutre du radar (pas de
 * detection du type de relation cote public, meme limitation que
 * l'editeur — `relationTypes` vide).
 */
export default function PublicRelationshipBlock({
  axes,
  target,
  hrefBase,
  events,
  calendar,
}: {
  axes: Partial<Record<RelationshipAxisKey, number>>;
  target: { name: string; slug: string } | null;
  hrefBase: string;
  events: AttitudeEventRow[];
  calendar: CalendarConfigInput | null;
}) {
  const rows: PublicSouvenirRow[] = events.map((event) => ({
    id: event.id,
    summary: event.summary,
    effect: formatDeltas(event.deltas as Partial<Record<RelationshipAxisKey, number>>),
    occurredAtIngame: event.occurred_at_ingame as unknown as PublicSouvenirRow["occurredAtIngame"],
  }));
  return (
    <div className="flex flex-col items-center gap-2">
      {target && (
        <p className="text-xs text-ink-muted">
          Envers{" "}
          <Link href={`${hrefBase}/${target.slug}`} className="rich-ref-mention">
            {target.name}
          </Link>
        </p>
      )}
      <RelationshipRadar axes={axes} relationTypes={[]} />
      <PublicSouvenirsTable rows={rows} calendar={calendar} />
    </div>
  );
}
