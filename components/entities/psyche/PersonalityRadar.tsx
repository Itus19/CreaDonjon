import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "@/src/core/psyche/keys";
import type { PersonalityArchetype } from "@/src/core/psyche/archetype";
import { PERSONALITY_POLE_DESCRIPTIONS_FR, PERSONALITY_POLES_FR } from "@/src/i18n/fr";
import PoleRadar from "./PoleRadar";

/**
 * Radar hexagonal du bloc `personality` (V2-H1) — 0 au centre, ±100 au
 * bord : un PNJ neutre dessine un hexagone regulier a mi-rayon, jamais un
 * point. V3.1-70 : la bande nommee a chaque sommet, plus aucun nombre
 * (`PoleRadar`).
 */
export default function PersonalityRadar({
  poles,
  archetype,
  label,
}: {
  poles: { key: PersonalityPoleKey; value: number }[];
  archetype: PersonalityArchetype;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <PoleRadar
        keys={PERSONALITY_POLE_KEYS}
        table={PERSONALITY_POLES_FR}
        descriptions={PERSONALITY_POLE_DESCRIPTIONS_FR}
        poles={poles}
        color={`var(${archetype.colorVar})`}
        label={label}
      />
      <span
        className="rounded-full border px-3 py-1 text-xs font-semibold"
        style={{ borderColor: `var(${archetype.colorVar})`, color: `var(${archetype.colorVar})` }}
      >
        {archetype.name}
      </span>
    </div>
  );
}
