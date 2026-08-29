import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "@/src/core/psyche/keys";
import type { PersonalityArchetype } from "@/src/core/psyche/archetype";
import { PERSONALITY_POLE_DESCRIPTIONS_FR } from "@/src/i18n/fr";

const AXIS_LABELS_FR: Record<PersonalityPoleKey, string> = {
  curiosity_caution: "Curiosité",
  altruism_selfishness: "Altruisme",
  empathy_hardness: "Empathie",
  impulse_prudence: "Impulsivité",
  extraversion_reserve: "Extraversion",
  authority_independence: "Autorité",
};

const SIZE = 240;
const CENTER = SIZE / 2;
const MAX_RADIUS = 90;
const RINGS = [0.25, 0.5, 0.75, 1];

function pointFor(index: number, radiusFraction: number): { x: number; y: number } {
  const angle = (-90 + index * 60) * (Math.PI / 180);
  const r = radiusFraction * MAX_RADIUS;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function polygonPoints(radiusFraction: number | ((index: number) => number)): string {
  return PERSONALITY_POLE_KEYS.map((_, i) => {
    const p = pointFor(i, typeof radiusFraction === "function" ? radiusFraction(i) : radiusFraction);
    return `${p.x},${p.y}`;
  }).join(" ");
}

/**
 * Radar hexagonal du bloc `personality` (V2-H1) — 0 au centre, ±100 au
 * bord : un PNJ neutre dessine un hexagone regulier a mi-rayon, jamais un
 * point. Esthetique de reference fournie par l'utilisateur (anneaux
 * concentriques + polygone rempli teinte).
 */
export default function PersonalityRadar({
  poles,
  archetype,
}: {
  poles: { key: PersonalityPoleKey; value: number }[];
  archetype: PersonalityArchetype;
}) {
  const valueByKey = new Map(poles.map((p) => [p.key, p.value]));
  const dataPoints = polygonPoints((i) => {
    const value = valueByKey.get(PERSONALITY_POLE_KEYS[i]) ?? 0;
    return (value + 100) / 200;
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[240px]">
        {RINGS.map((r) => (
          <polygon key={r} points={polygonPoints(r)} fill="none" stroke="var(--edge)" strokeWidth={1} />
        ))}
        {PERSONALITY_POLE_KEYS.map((_, i) => {
          const p = pointFor(i, 1);
          return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--edge)" strokeWidth={1} />;
        })}
        <polygon
          points={dataPoints}
          fill={`var(${archetype.colorVar})`}
          fillOpacity={0.35}
          stroke={`var(${archetype.colorVar})`}
          strokeWidth={2}
        />
        {PERSONALITY_POLE_KEYS.map((key, i) => {
          const label = pointFor(i, 1.22);
          return (
            <text
              key={key}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--ink-muted)] text-[9px]"
            >
              <title>{PERSONALITY_POLE_DESCRIPTIONS_FR[key]}</title>
              {AXIS_LABELS_FR[key]}
            </text>
          );
        })}
      </svg>
      <span
        className="rounded-full border px-3 py-1 text-xs font-semibold"
        style={{ borderColor: `var(${archetype.colorVar})`, color: `var(${archetype.colorVar})` }}
      >
        {archetype.name}
      </span>
    </div>
  );
}
