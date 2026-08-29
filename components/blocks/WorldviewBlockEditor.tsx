"use client";

import { useState } from "react";
import WorldviewRadar from "@/components/entities/psyche/WorldviewRadar";
import WorldviewPoleSliders from "@/components/entities/psyche/WorldviewPoleSliders";
import WorldviewEventTable from "@/components/entities/psyche/WorldviewEventTable";
import { WORLDVIEW_POLE_KEYS, type WorldviewPoleKey } from "@/src/core/psyche/keys";
import type { WorldviewBlockData } from "@/src/core/schemas/blocks/worldview";

const POLE_LABELS_FR: Record<WorldviewPoleKey, string> = {
  order_freedom: "Ordre ↔ Liberté",
  mercy_justice: "Miséricorde ↔ Justice",
  sacred_profane: "Sacré ↔ Profane",
  tradition_progress: "Tradition ↔ Progrès",
  individual_collective: "Individu ↔ Collectif",
  wealth_honor: "Richesse ↔ Honneur",
  peace_force: "Paix ↔ Force",
};

/**
 * Bloc `worldview` (V2-H1) : convictions morales/politiques, meme
 * esthetique que `personality` (radar + curseurs + tableau de souvenirs),
 * sans archetype colore (pas demande) ni les champs propres au
 * temperament (aspirations, lignes rouges...). Attachable a une entite ou
 * une faction — la comparaison avec la faction reste a construire
 * (necessite un vrai cas concret d'usage).
 */
export default function WorldviewBlockEditor({
  blockId,
  version,
  entityId,
  data,
  onChange,
  onBlockRefreshed,
}: {
  blockId: string;
  version: number;
  entityId: string;
  data: WorldviewBlockData;
  onChange: (data: WorldviewBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
}) {
  const [sliderPending, setSliderPending] = useState(false);
  const [sliderError, setSliderError] = useState<string | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);

  async function commitSlider(key: WorldviewPoleKey, delta: number, confirmed = false) {
    if (!confirmed && Math.abs(delta) > 40) {
      if (!window.confirm("Ce changement est important (> 40). Confirmer ?")) return;
      confirmed = true;
    }
    setSliderPending(true);
    setSliderError(null);
    const summary = `Réglage manuel : ${POLE_LABELS_FR[key].split(" ↔ ")[0]} ${delta > 0 ? "+" : ""}${delta}`;
    const res = await fetch(`/api/blocks/${blockId}/worldview-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, summary, deltas: { [key]: delta }, occurredAtIngame: null, confirmed: true }),
    });
    setSliderPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSliderError(body?.error ?? "Impossible d'ajuster ce pôle.");
      return;
    }
    const body = (await res.json()) as { block: { id: string; data: unknown; version: number } };
    onBlockRefreshed(body.block);
    setReloadSignal((n) => n + 1);
  }

  function togglePriority(key: WorldviewPoleKey) {
    const already = data.priority.includes(key);
    onChange({ ...data, priority: already ? data.priority.filter((k) => k !== key) : [...data.priority, key] });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-6">
        <WorldviewRadar poles={data.poles} />
        <div className="min-w-[220px] flex-1">
          <WorldviewPoleSliders poles={data.poles} onCommit={commitSlider} disabled={sliderPending} />
          {sliderError && <p className="mt-1 text-xs text-danger">{sliderError}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Priorité (par ordre, en cas de conflit entre convictions)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {WORLDVIEW_POLE_KEYS.map((key) => {
            const rank = data.priority.indexOf(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => togglePriority(key)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  rank >= 0 ? "border-accent bg-panel-raised text-ink" : "border-edge text-ink-muted hover:bg-panel-raised"
                }`}
              >
                {rank >= 0 ? `${rank + 1}. ` : ""}
                {POLE_LABELS_FR[key].split(" ↔ ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* `key` force un remontage (donc un rechargement de son useEffect) apres un souvenir ajoute via le curseur, en dehors du tableau lui-meme. */}
      <WorldviewEventTable
        key={reloadSignal}
        entityId={entityId}
        blockId={blockId}
        version={version}
        onBlockRefreshed={onBlockRefreshed}
      />
    </div>
  );
}
