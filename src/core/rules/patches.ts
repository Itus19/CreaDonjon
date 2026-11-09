import type { ResolvedFeature } from "./sheet";

/**
 * V3.1-168 (ADR 0077) — une règle qui en modifie une autre, par des
 * RETOUCHES fermées déclarées par la fiche qui modifie : le rayon d'une aura
 * (Aura étendue), la recharge d'une ressource (Source d'inspiration), la
 * durée d'un effet qui dure, la portée d'une activation. Appliquées aux
 * aptitudes du personnage avant le calcul de la fiche ; une retouche vers une
 * règle absente, ou un champ inconnu, ne fait rien.
 */
export function applyPatches(features: readonly ResolvedFeature[]): ResolvedFeature[] {
  const patches = features.flatMap((f) => f.patches ?? []);
  if (patches.length === 0) return [...features];
  return features.map((f) => {
    let out = f;
    for (const p of patches.filter((x) => x.rule === f.key)) {
      const [kind, ...rest] = p.field.split(".");
      if (kind === "aura" && rest[0] === "radius" && typeof p.value === "number" && out.auras) {
        out = { ...out, auras: out.auras.map((a) => ({ ...a, radius: p.value as number })) };
      } else if (kind === "resource" && rest.length === 2 && rest[1] === "recharge" && typeof p.value === "string" && out.resources) {
        out = { ...out, resources: out.resources.map((r) => (r.key === rest[0] ? { ...r, recharge: p.value as typeof r.recharge } : r)) };
      } else if (kind === "durable_effect" && rest.length === 2 && rest[1] === "duration" && typeof p.value === "object" && out.activation) {
        out = { ...out, activation: { ...out.activation, durable_effects: out.activation.durable_effects.map((d) => (d.id === rest[0] ? { ...d, duration: p.value as typeof d.duration } : d)) } };
      } else if (kind === "activation" && rest.length === 2 && rest[1] === "range" && typeof p.value === "number" && out.activation) {
        out = {
          ...out,
          activation: { ...out.activation, activations: out.activation.activations.map((a) => (a.id === rest[0] ? { ...a, targets: { ...a.targets, range: { value: p.value as number, unit: "m" as const } } } : a)) },
        };
      }
    }
    return out;
  });
}
