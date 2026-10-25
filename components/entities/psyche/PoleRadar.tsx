import { bandTierFor } from "@/src/core/psyche/bands";
import { NEUTRAL_POLE_SHORT, poleBandLabel } from "@/src/core/psyche/poles";
import type { PoleDisplayFr } from "@/src/i18n/fr";

const SIZE = 240;
const CENTER = SIZE / 2;
const MAX_RADIUS = 90;
const RINGS = [0.25, 0.5, 0.75, 1];

/**
 * V3.1-70 — le radar des pôles, commun à la Personnalité (6 axes) et aux
 * Convictions (7 axes). Aucun nombre n'est écrit : à chaque sommet, la BANDE
 * nommée (« Altruisme fort », « Dureté légère », « Prudence : neutre »).
 * `overlay` pose une autre série en pointillé bleu (la faction comparée).
 *
 * Composant sans état ni crochet : il sert aussi au wiki public, rendu côté
 * serveur.
 */
export default function PoleRadar<K extends string>({
  keys,
  table,
  descriptions,
  poles,
  overlay,
  color,
  label,
}: {
  keys: readonly K[];
  table: Record<K, PoleDisplayFr>;
  descriptions: Record<string, string>;
  poles: { key: K; value: number }[];
  /** Valeurs d'une autre fiche à comparer ; absent ou vide : rien n'est tracé. */
  overlay?: Partial<Record<K, number>> | null;
  /** Couleur du polygone (une variable CSS). */
  color: string;
  /** Nom accessible du schéma. */
  label: string;
}) {
  const count = keys.length;
  const pointFor = (index: number, radiusFraction: number) => {
    const angle = (-90 + index * (360 / count)) * (Math.PI / 180);
    const r = radiusFraction * MAX_RADIUS;
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
  };
  const polygon = (radius: number | ((index: number) => number)) =>
    keys
      .map((_, i) => {
        const p = pointFor(i, typeof radius === "function" ? radius(i) : radius);
        return `${p.x},${p.y}`;
      })
      .join(" ");
  const valueByKey = new Map(poles.map((p) => [p.key, p.value]));
  const fraction = (value: number) => (value + 100) / 200;
  const hasOverlay = overlay !== null && overlay !== undefined && Object.keys(overlay).length > 0;

  return (
    <svg viewBox="-130 -12 500 264" className="w-full max-w-[500px]" role="img" aria-label={label}>
      {RINGS.map((r) => (
        <polygon key={r} points={polygon(r)} fill="none" stroke="var(--edge)" strokeWidth={1} />
      ))}
      <polygon points={polygon(0.5)} fill="none" stroke="var(--edge-strong)" strokeWidth={1} strokeDasharray="3 3" />
      {keys.map((_, i) => {
        const p = pointFor(i, 1);
        return <line key={i} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--edge)" strokeWidth={1} />;
      })}
      {hasOverlay && (
        <polygon
          points={polygon((i) => fraction(overlay[keys[i]] ?? 0))}
          fill="var(--players)"
          fillOpacity={0.14}
          stroke="var(--players)"
          strokeWidth={1.6}
          strokeDasharray="5 3"
        />
      )}
      <polygon
        points={polygon((i) => fraction(valueByKey.get(keys[i]) ?? 0))}
        fill={color}
        fillOpacity={0.3}
        stroke={color}
        strokeWidth={2}
      />
      {keys.map((key, i) => {
        const p = pointFor(i, fraction(valueByKey.get(key) ?? 0));
        return <circle key={key} cx={p.x} cy={p.y} r={3.5} fill={color} />;
      })}
      {keys.map((key, i) => {
        const at = pointFor(i, 1.16);
        const value = valueByKey.get(key) ?? 0;
        const neutral = bandTierFor(value) === "neutral";
        const text = neutral ? `${table[key].radar} : ${NEUTRAL_POLE_SHORT}` : poleBandLabel(table[key], value);
        const anchor = at.x < CENTER - 6 ? "end" : at.x > CENTER + 6 ? "start" : "middle";
        return (
          <text
            key={key}
            x={at.x}
            y={at.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className={`text-xs ${neutral ? "fill-[var(--ink-muted)]" : "fill-[var(--ink)] font-semibold"}`}
          >
            <title>{descriptions[key]}</title>
            {text}
          </text>
        );
      })}
    </svg>
  );
}
