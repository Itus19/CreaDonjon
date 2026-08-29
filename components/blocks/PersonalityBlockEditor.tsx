"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import PersonalityRadar from "@/components/entities/psyche/PersonalityRadar";
import PersonalityPoleSliders from "@/components/entities/psyche/PersonalityPoleSliders";
import PersonalityEventTable from "@/components/entities/psyche/PersonalityEventTable";
import { archetypeFor } from "@/src/core/psyche/archetype";
import { PERSONALITY_POLE_KEYS, type PersonalityPoleKey } from "@/src/core/psyche/keys";
import type { Aspiration, PersonalityBlockData } from "@/src/core/schemas/blocks/personality";

const POLE_LABELS_FR: Record<PersonalityPoleKey, string> = {
  curiosity_caution: "Curiosité ↔ Prudence",
  altruism_selfishness: "Altruisme ↔ Égoïsme",
  empathy_hardness: "Empathie ↔ Dureté",
  impulse_prudence: "Impulsivité ↔ Prudence",
  extraversion_reserve: "Extraversion ↔ Réserve",
  authority_independence: "Autorité ↔ Indépendance",
};

const HORIZON_OPTIONS = [
  { value: "life", label: "Toute une vie" },
  { value: "arc", label: "Cette intrigue" },
  { value: "session", label: "Ce soir" },
];

function newId(): string {
  return crypto.randomUUID();
}

function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => onChange(items.map((it, j) => (j === i ? e.target.value : it)))}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-ink outline-none"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-xs text-danger hover:underline"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        {addLabel}
      </button>
    </div>
  );
}

/**
 * Bloc `personality` (V2-H1) : radar + curseurs a cote (esthetique fournie
 * par l'utilisateur), puis les champs de configuration simples, puis le
 * tableau de souvenirs en pleine largeur. Les poles ne changent JAMAIS par
 * `onChange` (sauvegarde generique silencieuse) — uniquement via la route
 * `personality-event`, curseur ou tableau, meme chemin d'ecriture.
 */
export default function PersonalityBlockEditor({
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
  data: PersonalityBlockData;
  onChange: (data: PersonalityBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
}) {
  const [sliderPending, setSliderPending] = useState(false);
  const [sliderError, setSliderError] = useState<string | null>(null);
  const [reloadSignal, setReloadSignal] = useState(0);

  const archetype = archetypeFor(Object.fromEntries(data.poles.map((p) => [p.key, p.value])));

  async function commitSlider(key: PersonalityPoleKey, delta: number, confirmed = false) {
    if (!confirmed && Math.abs(delta) > 40) {
      if (!window.confirm("Ce changement est important (> 40). Confirmer ?")) return;
      confirmed = true;
    }
    setSliderPending(true);
    setSliderError(null);
    const summary = `Réglage manuel : ${POLE_LABELS_FR[key].split(" ↔ ")[0]} ${delta > 0 ? "+" : ""}${delta}`;
    const res = await fetch(`/api/blocks/${blockId}/personality-event`, {
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

  function addAspiration() {
    const aspiration: Aspiration = {
      id: newId(),
      text: "",
      horizon: "session",
      intensity: 2,
      visibility: { level: "public", scopeId: null },
    };
    onChange({ ...data, aspirations: [...data.aspirations, aspiration] });
  }
  function updateAspiration(id: string, patch: Partial<Aspiration>) {
    onChange({ ...data, aspirations: data.aspirations.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }
  function removeAspiration(id: string) {
    onChange({ ...data, aspirations: data.aspirations.filter((a) => a.id !== id) });
  }

  function togglePriority(key: PersonalityPoleKey) {
    const already = data.priority.includes(key);
    onChange({ ...data, priority: already ? data.priority.filter((k) => k !== key) : [...data.priority, key] });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-6">
        <PersonalityRadar poles={data.poles} archetype={archetype} />
        <div className="min-w-[220px] flex-1">
          <PersonalityPoleSliders poles={data.poles} onCommit={commitSlider} disabled={sliderPending} />
          {sliderError && <p className="mt-1 text-xs text-danger">{sliderError}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Priorité (par ordre, en cas de conflit entre pôles)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PERSONALITY_POLE_KEYS.map((key) => {
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

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Aspirations</span>
        {data.aspirations.map((aspiration) => (
          <div key={aspiration.id} className="flex flex-wrap items-center gap-2">
            <input
              value={aspiration.text}
              onChange={(e) => updateAspiration(aspiration.id, { text: e.target.value })}
              placeholder="Devenir la plus grande magicienne de sa génération"
              className="min-w-[220px] flex-1 bg-transparent text-sm text-ink outline-none"
            />
            <Dropdown
              value={aspiration.horizon}
              options={HORIZON_OPTIONS}
              onChange={(v) => updateAspiration(aspiration.id, { horizon: v as Aspiration["horizon"] })}
              aria-label="Horizon"
            />
            <Dropdown
              value={aspiration.visibility.level}
              options={VISIBILITY_OPTIONS}
              onChange={(v) =>
                updateAspiration(aspiration.id, { visibility: { level: v as Aspiration["visibility"]["level"], scopeId: null } })
              }
              aria-label="Visibilité de l'aspiration"
            />
            <button
              type="button"
              onClick={() => removeAspiration(aspiration.id)}
              className="text-xs text-danger hover:underline"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addAspiration}
          className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          + Ajouter une aspiration
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Lignes rouges (ne fera jamais)
          </span>
          <StringListEditor
            items={data.lines}
            onChange={(lines) => onChange({ ...data, lines })}
            placeholder="Ne trahira jamais un serment prêté à voix haute"
            addLabel="+ Ajouter une ligne rouge"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Limites (fera à contrecœur)
          </span>
          <StringListEditor
            items={data.limits}
            onChange={(limits) => onChange({ ...data, limits })}
            placeholder="Mentira, mais mal et à contrecœur"
            addLabel="+ Ajouter une limite"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Façon de parler</span>
        <input
          value={data.speech.register}
          onChange={(e) => onChange({ ...data, speech: { ...data.speech, register: e.target.value } })}
          placeholder="Registre (ex. familier, soutenu…)"
          className="bg-transparent text-sm text-ink outline-none"
        />
        <StringListEditor
          items={data.speech.tics}
          onChange={(tics) => onChange({ ...data, speech: { ...data.speech, tics } })}
          placeholder="Appelle tout le monde « petit »"
          addLabel="+ Ajouter un tic de langage"
        />
      </div>

      <PersonalityEventTable
        entityId={entityId}
        blockId={blockId}
        version={version}
        onBlockRefreshed={onBlockRefreshed}
        reloadSignal={reloadSignal}
      />
    </div>
  );
}
