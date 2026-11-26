import type { RoomExposure, RoomsBlockData } from "@/src/core/schemas/blocks/rooms";

/** ME-4 — seulement ce qui s'écarte du « dedans » par défaut. */
const EXPOSITION_VISIBLE: Partial<Record<RoomExposure, string>> = { sheltered: "à l'abri", outdoor: "dehors" };

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
          <span className="font-medium text-ink">
            {r.name}
            {r.exposure && EXPOSITION_VISIBLE[r.exposure] && <span className="ml-2 text-xs font-normal text-ink-muted">{EXPOSITION_VISIBLE[r.exposure]}</span>}
          </span>
          {r.description && <span className="text-ink-soft">{r.description}</span>}
        </li>
      ))}
    </ul>
  );
}
