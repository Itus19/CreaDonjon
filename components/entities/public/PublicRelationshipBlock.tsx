import Link from "next/link";
import RelationshipRadar from "@/components/entities/psyche/RelationshipRadar";
import PublicSouvenirsTable, { type PublicSouvenirRow } from "./PublicSouvenirsTable";
import { type RelationshipAxisKey } from "@/src/core/psyche/keys";
import type { AttitudeEventRow } from "@/src/server/repos/psyche";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import { useTranslations } from "next-intl";
import { RELATIONSHIP_AXES_FR } from "@/src/i18n/fr";

/** L'effet d'un souvenir pour le lecteur : le côté vers lequel il pousse, jamais un nombre. */
function formatDeltas(deltas: Partial<Record<RelationshipAxisKey, number>>, vers: (axe: string) => string): string {
  return Object.entries(deltas)
    .filter(([key]) => key in RELATIONSHIP_AXES_FR)
    .map(([key, delta]) => {
      const axe = RELATIONSHIP_AXES_FR[key as RelationshipAxisKey];
      return vers(delta! > 0 ? axe.positive : axe.negative);
    })
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
  const t = useTranslations("fiche.relation");
  const rows: PublicSouvenirRow[] = events.map((event) => ({
    id: event.id,
    summary: event.summary,
    effect: formatDeltas(event.deltas as Partial<Record<RelationshipAxisKey, number>>, (axe) => t("versAxe", { axe })),
    occurredAtIngame: event.occurred_at_ingame as unknown as PublicSouvenirRow["occurredAtIngame"],
  }));
  return (
    <div className="flex flex-col items-center gap-2">
      {target && (
        <p className="text-xs text-ink-muted">
          {t("envers")}{" "}
          {/* `prefetch={false}` (V2.1-20 lot 6) : voir `PublicBlockView` — une route dynamique prechargee n'est jamais reutilisee (`staleTimes.dynamic` vaut 0), le prechargement ne rapporte que du travail serveur. */}
          <Link href={`${hrefBase}/${target.slug}`} prefetch={false} className="rich-ref-mention">
            {target.name}
          </Link>
        </p>
      )}
      <RelationshipRadar axes={axes} relationTypes={[]} />
      <PublicSouvenirsTable rows={rows} calendar={calendar} />
    </div>
  );
}
