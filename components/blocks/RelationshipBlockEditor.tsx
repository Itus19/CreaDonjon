"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import RelationshipRadar from "@/components/entities/psyche/RelationshipRadar";
import RelationshipAxisSliders from "@/components/entities/psyche/RelationshipAxisSliders";
import RelationshipEventTable from "@/components/entities/psyche/RelationshipEventTable";
import type { RelationshipAxisKey } from "@/src/core/psyche/keys";
import type { RelationshipBlockData } from "@/src/core/schemas/blocks/relationship";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";

const NO_ENTITY = "";

/**
 * Bloc `relationship` (V2-H1) : radar + curseurs + tableau de souvenirs,
 * meme esthetique que `personality` mais sur des valeurs qui ne vivent PAS
 * dans le bloc — `entity_attitudes`/`attitude_events`, portee campagne
 * (docs/adr/0013-tables-psyche-pnj.md). Sans campagne active, la relation
 * reste structurelle (cible, `knownAs`) mais rien a regler.
 */
export default function RelationshipBlockEditor({
  entityId,
  data,
  otherEntities,
  onChange,
}: {
  entityId: string;
  data: RelationshipBlockData;
  otherEntities: OtherEntityOption[];
  onChange: (data: RelationshipBlockData) => void;
}) {
  const [axes, setAxes] = useState<Partial<Record<RelationshipAxisKey, number>>>({});
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [loadedTargetId, setLoadedTargetId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Position en cours de glissement, remontee par le curseur a chaque pixel
  // (avant tout appel reseau) : sans ca, le radar n'a que la valeur
  // enregistree en base et ne bouge qu'apres l'aller-retour du commit.
  const [liveOverride, setLiveOverride] = useState<Partial<Record<RelationshipAxisKey, number>>>({});

  function handleLiveChange(key: RelationshipAxisKey, value: number | null) {
    setLiveOverride((prev) => {
      if (value === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }

  const targetId = data.target?.kind === "entity" ? data.target.id : null;
  const loaded = !targetId || loadedTargetId === targetId;

  useEffect(() => {
    if (!targetId) return;
    fetch(`/api/entities/${entityId}/attitudes/${targetId}`)
      .then((res) => (res.ok ? res.json() : { axes: {}, campaignId: null }))
      .then((body: { axes: Partial<Record<RelationshipAxisKey, number>>; campaignId: string | null }) => {
        setAxes(body.axes);
        setCampaignId(body.campaignId);
        setLoadedTargetId(targetId);
      });
  }, [entityId, targetId]);

  async function commitAxis(key: RelationshipAxisKey, delta: number, confirmed = false) {
    if (!targetId) return;
    if (!confirmed && Math.abs(delta) > 40) {
      if (!window.confirm("Ce changement est important (> 40). Confirmer ?")) return;
      confirmed = true;
    }
    setPending(true);
    setError(null);
    const summary = `Réglage manuel : ${key} ${delta > 0 ? "+" : ""}${delta}`;
    const res = await fetch(`/api/entities/${entityId}/attitude-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetEntityId: targetId, summary, deltas: { [key]: delta }, occurredAtIngame: null, confirmed: true }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible d'ajuster cet axe.");
      return;
    }
    const body = (await res.json()) as { axes: Partial<Record<RelationshipAxisKey, number>> };
    setAxes(body.axes);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Envers</span>
        <Dropdown
          value={targetId ?? NO_ENTITY}
          options={[{ value: NO_ENTITY, label: "— choisir une cible —" }, ...otherEntities.map((e) => ({ value: e.id, label: e.name }))]}
          onChange={(v) => onChange({ ...data, target: v === NO_ENTITY ? null : { kind: "entity", id: v } })}
          aria-label="Cible de la relation"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          Connue comme (identité que l&apos;entité croit connaître)
        </span>
        <input
          value={data.knownAs}
          onChange={(e) => onChange({ ...data, knownAs: e.target.value })}
          placeholder="un mercenaire de passage"
          className="bg-transparent text-sm text-ink outline-none"
        />
      </div>

      {!targetId && <p className="text-sm italic text-ink-muted">Choisissez une cible pour régler la relation.</p>}

      {targetId && !loaded && <p className="text-sm text-ink-muted">Chargement…</p>}

      {targetId && loaded && !campaignId && (
        <p className="text-sm italic text-ink-muted">
          Ce monde n&apos;a pas de campagne active — la relation reste définie, mais ses valeurs ne peuvent pas encore évoluer.
        </p>
      )}

      {targetId && loaded && campaignId && (
        <>
          <div className="flex flex-wrap gap-6">
            <RelationshipRadar axes={{ ...axes, ...liveOverride }} relationTypes={[]} />
            <div className="min-w-[220px] flex-1">
              <RelationshipAxisSliders
                axes={axes}
                onCommit={commitAxis}
                onLiveChange={handleLiveChange}
                disabled={pending}
              />
              {error && <p className="mt-1 text-xs text-danger">{error}</p>}
            </div>
          </div>
          <RelationshipEventTable sourceEntityId={entityId} targetEntityId={targetId} onAxesChanged={setAxes} />
        </>
      )}
    </div>
  );
}
