import type { RoomsBlockData } from "@/src/core/schemas/blocks/rooms";

/**
 * V3.2-19 — le bloc « Pièces » en lecture : une pièce par ligne, son nom en
 * intertitre et ses phrases dessous. Même dessin sobre que la carte d'un
 * lieu ; aucune interaction.
 */
export default function RoomsView({ data }: { data: RoomsBlockData }) {
  if (data.rooms.length === 0) return <p className="text-sm text-ink-muted">Aucune pièce décrite pour ce lieu.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {data.rooms.map((r) => (
        <li key={r.id} className="flex flex-col gap-0.5 border-b border-edge/20 pb-2 last:border-b-0 last:pb-0">
          <span className="font-medium text-ink">{r.name}</span>
          {r.description && <span className="text-ink-soft">{r.description}</span>}
        </li>
      ))}
    </ul>
  );
}
