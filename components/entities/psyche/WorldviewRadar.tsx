import { WORLDVIEW_POLE_KEYS, type WorldviewPoleKey } from "@/src/core/psyche/keys";
import { WORLDVIEW_POLE_DESCRIPTIONS_FR, WORLDVIEW_POLES_FR } from "@/src/i18n/fr";
import PoleRadar from "./PoleRadar";

/**
 * Radar a 7 axes du bloc `worldview` (V2-H1) — meme dessin que
 * `PersonalityRadar`, une seule teinte (`--accent`, pas d'archetype pour des
 * convictions). V3.1-70 : `overlay` pose la faction comparee en pointille bleu.
 */
export default function WorldviewRadar({
  poles,
  overlay,
  label,
}: {
  poles: { key: WorldviewPoleKey; value: number }[];
  overlay?: Partial<Record<WorldviewPoleKey, number>> | null;
  label: string;
}) {
  return (
    <PoleRadar
      keys={WORLDVIEW_POLE_KEYS}
      table={WORLDVIEW_POLES_FR}
      descriptions={WORLDVIEW_POLE_DESCRIPTIONS_FR}
      poles={poles}
      overlay={overlay}
      color="var(--accent)"
      label={label}
    />
  );
}
