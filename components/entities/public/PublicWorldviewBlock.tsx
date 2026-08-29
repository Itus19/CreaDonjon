import WorldviewRadar from "@/components/entities/psyche/WorldviewRadar";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";

/** Rendu public du bloc `worldview` (V2-H2, "juste la partie des schemas") — le radar seul, jamais le tableau de souvenirs. */
export default function PublicWorldviewBlock({ data }: { data: WorldviewBlockData }) {
  return <WorldviewRadar poles={data.poles} />;
}
