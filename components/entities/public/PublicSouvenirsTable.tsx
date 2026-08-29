import { formatGameDate } from "@/src/core/calendar/formatDate";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { GameDate } from "@/src/core/calendar/types";

export interface PublicSouvenirRow {
  id: string;
  summary: string;
  effect: string;
  occurredAtIngame: GameDate | null;
}

/**
 * Tableau de souvenirs du wiki public (V2, retour utilisateur point 5) —
 * partage par les rendus `personality`/`worldview`/`relationship`, deja
 * filtre par `is_public` cote serveur (publicShare.ts). `null` (jamais un
 * tableau vide affiche) si aucun souvenir n'est public — la section
 * disparait plutot que de reveler qu'il en existe de masques.
 *
 * Seule la date INGAME est montree, jamais la date IRL (quand le MJ a
 * saisi la ligne) : utile a un MJ qui suit son propre travail, pas a un
 * lecteur du wiki qui ne s'interesse qu'a la chronologie de la fiction.
 */
export default function PublicSouvenirsTable({
  rows,
  calendar,
}: {
  rows: PublicSouvenirRow[];
  calendar: CalendarConfigInput | null;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-edge/60 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            <th className="py-1 pr-4">Date</th>
            <th className="py-1 pr-4">Événement</th>
            <th className="py-1 pr-4">Effet</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-edge/30 align-top">
              <td className="whitespace-nowrap py-1.5 pr-4 text-xs text-ink-muted">
                {row.occurredAtIngame && calendar ? formatGameDate(row.occurredAtIngame, calendar) : "—"}
              </td>
              <td className="py-1.5 pr-4">{row.summary}</td>
              <td className="py-1.5 pr-4 text-xs text-ink-muted">{row.effect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
