"use client";

import type { GeneratorToolWindowData } from "@/src/server/services/generators";
import { RANDOM_VARIANT_VALUE } from "@/src/core/generators/variants";

type Axes = NonNullable<GeneratorToolWindowData["variants"]>;

/**
 * Variantes de l'outil en puces (V3.1-45) : une rangee par axe, « Aléatoire »
 * compris quand l'axe l'autorise. Boutons `aria-pressed` — plus aucune liste
 * deroulante. La valeur par defaut d'un axe reste sa premiere option.
 */
export default function PuceVariantes({
  axes,
  choix,
  onChoisir,
}: {
  axes: Axes;
  choix: Record<string, string>;
  onChoisir: (axe: string, valeur: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {axes.map((axe) => {
        const courant = choix[axe.key] ?? axe.options[0]?.key ?? "";
        const options = [
          ...(axe.allowRandom ? [{ key: RANDOM_VARIANT_VALUE, label: "Aléatoire" }] : []),
          ...axe.options,
        ];
        return (
          <div key={axe.key} role="group" aria-label={axe.label} className="flex flex-wrap items-center gap-1.5">
            <span className="w-full text-xs text-ink-muted @md:w-auto @md:pr-1">{axe.label}</span>
            {options.map((o) => {
              const actif = courant === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => onChoisir(axe.key, o.key)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                    actif ? "border-accent bg-accent/10 text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
