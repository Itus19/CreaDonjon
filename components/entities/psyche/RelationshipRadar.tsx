import { RELATIONSHIP_AXIS_KEYS, type RelationshipAxisKey } from "@/src/core/psyche/keys";
import { relationshipColor } from "@/src/core/psyche/relationshipColor";
import { RELATIONSHIP_AXIS_DESCRIPTIONS_FR } from "@/src/i18n/fr";

const AXIS_LABELS_FR: Record<RelationshipAxisKey, string> = {
  trust_distrust: "Confiance",
  friendship_hostility: "Amitié",
  respect_contempt: "Respect",
  attraction_repulsion: "Attirance",
  debt_independence: "Dette",
  fear_assurance: "Peur",
  interest_indifference: "Intérêt",
};

const SIZE = 240;
const CENTER = SIZE / 2;
const MAX_RADIUS = 90;
const RINGS = [0.25, 0.5, 0.75, 1];
const AXIS_COUNT = RELATIONSHIP_AXIS_KEYS.length;

function pointFor(index: number, radiusFraction: number): { x: number; y: number } {
  const angle = (-90 + index * (360 / AXIS_COUNT)) * (Math.PI / 180);
  const r = radiusFraction * MAX_RADIUS;
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function polygonPoints(radiusFraction: number | ((index: number) => number)): string {
  return RELATIONSHIP_AXIS_KEYS.map((_, i) => {
    const p = pointFor(i, typeof radiusFraction === "function" ? radiusFraction(i) : radiusFraction);
    return `${p.x},${p.y}`;
  }).join(" ");
}

/**
 * Radar a 7 axes du bloc `relationship` (V2-H1) — meme geometrie que
 * `PersonalityRadar` (0 au centre, ±100 au bord), teinte du polygone
 * derivee de `friendship_hostility` (`relationshipColor`, meme fonction
 * que les liens du futur graphe `worldview`).
 */
export default function RelationshipRadar({
  axes,
  relationTypes,
}: {
  axes: Partial<Record<RelationshipAxisKey, number>>;
  relationTypes: string[];
}) {
  const dataPoints = polygonPoints((i) => {
    const value = axes[RELATIONSHIP_AXIS_KEYS[i]] ?? 0;
    return (value + 100) / 200;
  });
  const color = relationshipColor(axes.friendship_hostility ?? 0, relationTypes);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[240px]">
      {RINGS.map((r) => (
        <polygon key={r} points={polygonPoints(r)} fill="none" stroke="var(--edge)" strokeWidth={1} />
      ))}
      {RELATIONSHIP_AXIS_KEYS.map((_, i) => {
        const p = pointFor(i, 1);
        return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--edge)" strokeWidth={1} />;
      })}
      <polygon points={dataPoints} fill={color} fillOpacity={0.35} stroke={color} strokeWidth={2} />
      {RELATIONSHIP_AXIS_KEYS.map((key, i) => {
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
            <title>{RELATIONSHIP_AXIS_DESCRIPTIONS_FR[key]}</title>
            {AXIS_LABELS_FR[key]}
          </text>
        );
      })}
    </svg>
  );
}
