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

/** Meme libelles que RelationshipEventTable.tsx/RelationshipAxisSliders.tsx — jamais la cle brute ("trust_distrust") dans un resume genere. */
const AXIS_LABELS_FR: Record<RelationshipAxisKey, string> = {
  trust_distrust: "Confiance ↔ Méfiance",
  friendship_hostility: "Amitié ↔ Hostilité",
  respect_contempt: "Respect ↔ Mépris",
  attraction_repulsion: "Attirance ↔ Répulsion",
  debt_independence: "Dette ↔ Indépendance",
  fear_assurance: "Peur ↔ Assurance",
  interest_indifference: "Intérêt ↔ Indifférence",
};

/**
 * Bloc `relationship` (V2-H1) : radar + curseurs + tableau de souvenirs,
 * meme esthetique que `personality` mais sur des valeurs qui ne vivent PAS
 * dans le bloc — `entity_attitudes`/`attitude_events`, portee campagne
 * (docs/adr/0013-tables-psyche-pnj.md). Sans campagne active, la relation
 * reste structurelle (cible, `knownAs`) mais rien a regler.
 */
export default function RelationshipBlockEditor({
  entityId,
  worldSlug,
  data,
  otherEntities,
  onChange,
}: {
  entityId: string;
  worldSlug: string;
  data: RelationshipBlockData;
  otherEntities: OtherEntityOption[];
  onChange: (data: RelationshipBlockData) => void;
}) {
  const [axes, setAxes] = useState<Partial<Record<RelationshipAxisKey, number>>>({});
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [loadedTargetId, setLoadedTargetId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bug reel trouve en verifiant ce bloc : deplacer un curseur cree bien
  // le souvenir cote serveur (`commitAxis`), mais `RelationshipEventTable`
  // ne le voyait jamais tant que sa propre liste n'etait pas rechargee par
  // un autre moyen (changer de cible, recharger la page) — contrairement a
  // `PersonalityBlockEditor`/`WorldviewBlockEditor`, qui font deja rejouer
  // le tableau de souvenirs apres un reglage manuel via ce meme mecanisme.
  const [reloadSignal, setReloadSignal] = useState(0);
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
    // Garde d'annulation (petit bug trouve en verifiant ce bloc) : sans
    // elle, changer de cible deux fois rapidement (A -> B -> A) pouvait
    // laisser la reponse de B arriver APRES celle de A et ecraser les
    // bons axes avec ceux de la mauvaise cible, tout en marquant `loaded`
    // comme si tout etait a jour.
    let cancelled = false;
    fetch(`/api/entities/${entityId}/attitudes/${targetId}`)
      .then((res) => (res.ok ? res.json() : { axes: {}, campaignId: null }))
      .then((body: { axes: Partial<Record<RelationshipAxisKey, number>>; campaignId: string | null }) => {
        if (cancelled) return;
        setAxes(body.axes);
        setCampaignId(body.campaignId);
        setLoadedTargetId(targetId);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, targetId]);

  async function commitAxis(key: RelationshipAxisKey, delta: number) {
    if (!targetId) return;
    setPending(true);
    setError(null);
    // Meme libelle francais que le tableau de souvenirs (bug trouve en
    // verifiant ce bloc) : le resume auto-genere affichait la cle brute
    // ("trust_distrust +38") au lieu du nom francais, contrairement aux
    // blocs personality/worldview qui font deja cette traduction.
    const summary = `Réglage manuel : ${AXIS_LABELS_FR[key].split(" ↔ ")[0]} ${delta > 0 ? "+" : ""}${delta}`;
    const res = await fetch(`/api/entities/${entityId}/attitude-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetEntityId: targetId, summary, deltas: { [key]: delta }, occurredAtIngame: null }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Impossible d'ajuster cet axe.");
      return;
    }
    const body = (await res.json()) as { axes: Partial<Record<RelationshipAxisKey, number>> };
    setAxes(body.axes);
    setReloadSignal((n) => n + 1);
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
          <RelationshipEventTable
            sourceEntityId={entityId}
            targetEntityId={targetId}
            worldSlug={worldSlug}
            onAxesChanged={setAxes}
            reloadSignal={reloadSignal}
          />
        </>
      )}
    </div>
  );
}
