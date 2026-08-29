import { WORLDVIEW_POLE_KEYS, type WorldviewPoleKey } from "@/src/core/psyche/keys";

const AXIS_LABELS_FR: Record<WorldviewPoleKey, string> = {
  order_freedom: "Ordre",
  mercy_justice: "Miséricorde",
  sacred_profane: "Sacré",
  tradition_progress: "Tradition",
  individual_collective: "Individu",
  wealth_honor: "Richesse",
  peace_force: "Paix",
};

const SIZE = 240;
const CENTER = SIZE / 2;
const MAX_RADIUS = 90;
const RINGS = [0.25, 0.5, 0.75, 1];
const AXIS_COUNT = WORLDVIEW_POLE_KEYS.length;

function pointFor(index: number, radiusFraction: number): { x: number; y: number } {
  const angle = (-90 + index * (360 / AXIS_COUNT)) * (Math.PI / 180);
  const r = radiusFraction * MAX_RADIUS;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function polygonPoints(radiusFraction: number | ((index: number) => number)): string {
  return WORLDVIEW_POLE_KEYS.map((_, i) => {
    const p = pointFor(i, typeof radiusFraction === "function" ? radiusFraction(i) : radiusFraction);
    return `${p.x},${p.y}`;
  }).join(" ");
}

/**
 * Radar a 7 axes du bloc `worldview` (V2-H1) — convictions morales/
 * politiques, meme geometrie que `PersonalityRadar`/`RelationshipRadar`.
 * Pas d'archetype colore ici (non demande, aucune regle evidente a
 * inventer pour des convictions plutot qu'un temperament) : une seule
 * teinte fixe (`--accent`).
 */
export default function WorldviewRadar({ poles }: { poles: { key: WorldviewPoleKey; value: number }[] }) {
  const valueByKey = new Map(poles.map((p) => [p.key, p.value]));
  const dataPoints = polygonPoints((i) => {
    const value = valueByKey.get(WORLDVIEW_POLE_KEYS[i]) ?? 0;
    return (value + 100) / 200;
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[240px]">
      {RINGS.map((r) => (
        <polygon key={r} points={polygonPoints(r)} fill="none" stroke="var(--edge)" strokeWidth={1} />
      ))}
      {WORLDVIEW_POLE_KEYS.map((_, i) => {
        const p = pointFor(i, 1);
        return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--edge)" strokeWidth={1} />;
      })}
      <polygon points={dataPoints} fill="var(--accent)" fillOpacity={0.3} stroke="var(--accent)" strokeWidth={2} />
      {WORLDVIEW_POLE_KEYS.map((key, i) => {
        const label = pointFor(i, 1.24);
        return (
          <text
            key={key}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--ink-muted)] text-[9px]"
          >
            {AXIS_LABELS_FR[key]}
          </text>
        );
      })}
    </svg>
  );
}
