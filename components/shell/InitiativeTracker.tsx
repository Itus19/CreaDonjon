"use client";

import { useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import type { CombatDetail } from "@/src/server/services/combats";
import type { CombatParticipantRow, CombatRow } from "@/src/server/repos/combats";
import type { EncounterMonsterSummary } from "@/src/server/services/encounters";

const STATUS_LABELS: Record<string, string> = { draft: "Brouillon", running: "En cours", ended: "Terminé" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function hpBarColor(current: number, max: number): string {
  if (max <= 0) return "bg-ink-muted";
  const ratio = current / max;
  if (ratio <= 0) return "bg-ink-muted";
  if (ratio <= 0.33) return "bg-danger";
  if (ratio <= 0.66) return "bg-gm";
  return "bg-accent";
}

type AddParticipantMode = "entity" | "statblock" | "custom";

/**
 * Suivi d'initiative (V1-E4, specs/outils-mj.md §5) : liste des
 * participants tries par initiative, navigation de tour, PV/conditions/
 * concentration editables en place. Un participant `entity` (PJ) ecrit
 * AUSSI la fiche jouable (`entity_runtime_state`) a chaque modification —
 * retour explicite de l'utilisateur, deja garanti cote serveur
 * (`patchCombatParticipant`), cette interface se contente d'appeler la
 * meme route pour tous les types de participants.
 *
 * Le nom d'un participant `statblock` renvoie vers sa fiche de regle
 * complete (`/regles/[cle]`, deja construite avec Actions/Traits/reactions)
 * plutot que de dupliquer ce rendu dans un panneau separe — meme donnee,
 * un seul endroit qui l'affiche.
 */
export default function InitiativeTracker({
  worldSlug,
  campaignId,
  initialCombat,
  savedCombats,
  pcOptions,
  monsters,
  conditions,
}: {
  worldSlug: string;
  campaignId: string;
  initialCombat: CombatDetail | null;
  savedCombats: CombatRow[];
  pcOptions: { id: string; name: string }[];
  monsters: EncounterMonsterSummary[];
  conditions: string[];
}) {
  const [combat, setCombat] = useState<CombatRow | null>(initialCombat?.combat ?? null);
  const [participants, setParticipants] = useState<CombatParticipantRow[]>(initialCombat?.participants ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<AddParticipantMode>("statblock");
  const [monsterSearch, setMonsterSearch] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [selectedPcId, setSelectedPcId] = useState(pcOptions[0]?.id ?? "");

  async function refreshCombat(combatId: string) {
    const res = await fetch(`/api/campaigns/${campaignId}/combats/${combatId}`);
    if (!res.ok) return;
    const detail = (await res.json()) as CombatDetail;
    setCombat(detail.combat);
    setParticipants(detail.participants);
  }

  async function createDraftCombat() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/combats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: null, monsters: [] }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Impossible de créer le combat.");
        return;
      }
      setCombat(body);
      setParticipants([]);
    } finally {
      setBusy(false);
    }
  }

  async function beginCombat() {
    if (!combat) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}/begin`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Impossible de lancer le combat.");
        return;
      }
      await refreshCombat(combat.id);
    } finally {
      setBusy(false);
    }
  }

  async function endCombat() {
    if (!combat) return;
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}/end`, { method: "POST" });
      await refreshCombat(combat.id);
    } finally {
      setBusy(false);
    }
  }

  async function moveTurn(direction: "next" | "previous") {
    if (!combat) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const body = await res.json();
      if (res.ok) setCombat(body);
    } finally {
      setBusy(false);
    }
  }

  async function rollAll() {
    if (!combat) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}/roll-initiative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) await refreshCombat(combat.id);
    } finally {
      setBusy(false);
    }
  }

  async function rollOne(participantId: string) {
    if (!combat) return;
    await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}/roll-initiative`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    await refreshCombat(combat.id);
  }

  async function undo() {
    if (!combat) return;
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}/undo`, { method: "POST" });
      await refreshCombat(combat.id);
    } finally {
      setBusy(false);
    }
  }

  async function patchParticipant(participantId: string, patch: Record<string, unknown>, note: string) {
    const res = await fetch(`/api/campaigns/${campaignId}/combats/${combat?.id}/participants/${participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, note }),
    });
    if (res.ok) {
      const updated = (await res.json()) as CombatParticipantRow;
      setParticipants((prev) => prev.map((p) => (p.id === participantId ? updated : p)));
    }
  }

  async function changeHp(participant: CombatParticipantRow, delta: number) {
    const current = participant.hp_current ?? 0;
    const max = participant.hp_max ?? current;
    const next = Math.max(0, Math.min(max, current + delta));
    await patchParticipant(participant.id, { hpCurrent: next }, `PV ${delta >= 0 ? "+" : ""}${delta}`);
  }

  async function changeTempHp(participant: CombatParticipantRow, value: number) {
    await patchParticipant(participant.id, { tempHp: Math.max(0, value) }, "PV temporaires");
  }

  async function toggleCondition(participant: CombatParticipantRow, condition: string) {
    const current = (participant.conditions as unknown as string[]) ?? [];
    const next = current.includes(condition) ? current.filter((c) => c !== condition) : [...current, condition];
    await patchParticipant(participant.id, { conditions: next }, `Condition : ${condition}`);
  }

  async function removeParticipant(participantId: string) {
    if (!combat) return;
    await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}/participants/${participantId}`, { method: "DELETE" });
    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
  }

  async function addParticipant() {
    if (!combat) return;
    setBusy(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (addMode === "entity") {
        if (!selectedPcId) return;
        body = { sourceKind: "entity", entityId: selectedPcId, isAlly: true };
      } else if (addMode === "statblock") {
        const monster = filteredMonsters[0];
        if (!monster) return;
        body = { sourceKind: "statblock", entryKey: monster.key, label: monster.name, isAlly: false };
      } else {
        if (!customLabel.trim()) return;
        body = { sourceKind: "custom", label: customLabel.trim(), isAlly: false };
      }
      const res = await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Impossible d'ajouter ce participant.");
        return;
      }
      setParticipants((prev) => [...prev, result]);
      setCustomLabel("");
      setShowAddForm(false);
    } finally {
      setBusy(false);
    }
  }

  const filteredMonsters = monsters.filter((m) => m.name.toLowerCase().includes(monsterSearch.toLowerCase())).slice(0, 8);

  if (!combat) {
    return (
      <div className="flex flex-col gap-4">
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="button"
          onClick={createDraftCombat}
          disabled={busy}
          className="self-start rounded-full border border-accent px-4 py-1.5 text-sm text-accent transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          Nouveau combat
        </button>
        <p className="text-xs italic text-ink-muted">
          Ou composez une rencontre dans l&apos;onglet Rencontres et cliquez « Lancer le combat ».
        </p>
        <SavedCombatsList combats={savedCombats} />
      </div>
    );
  }

  const running = combat.status === "running";
  const activeParticipant = running ? participants[combat.turn_index] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink">{combat.name ?? "Combat"}</span>
        <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
          {STATUS_LABELS[combat.status] ?? combat.status}
          {running ? ` · Round ${combat.round}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
          >
            + Ajouter
          </button>
          <button
            type="button"
            onClick={rollAll}
            disabled={busy}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Lancer toutes les initiatives
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-panel-raised disabled:opacity-50"
            title="Annuler la dernière action"
          >
            ↶ Annuler
          </button>
          {!running ? (
            <button
              type="button"
              onClick={beginCombat}
              disabled={busy || participants.length === 0}
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-panel transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              ▶ Go
            </button>
          ) : (
            <button
              type="button"
              onClick={endCombat}
              disabled={busy}
              className="rounded-full bg-danger px-4 py-1.5 text-xs font-medium text-panel transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {running && (
        <div className="flex items-center justify-between rounded-md border border-edge/60 bg-panel-sunken px-4 py-2">
          <button type="button" onClick={() => moveTurn("previous")} disabled={busy} className="text-ink-muted hover:text-ink">
            ◁
          </button>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">Tour actuel</div>
            <div className="text-sm font-medium text-accent">{activeParticipant?.label ?? "—"}</div>
          </div>
          <button type="button" onClick={() => moveTurn("next")} disabled={busy} className="text-ink-muted hover:text-ink">
            ▷
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="flex flex-col gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
          <Dropdown
            value={addMode}
            onChange={(v) => setAddMode(v as AddParticipantMode)}
            options={[
              { value: "entity", label: "Personnage joueur" },
              { value: "statblock", label: "Monstre du ruleset" },
              { value: "custom", label: "Saisie libre" },
            ]}
          />
          {addMode === "entity" && (
            <Dropdown
              value={selectedPcId}
              onChange={setSelectedPcId}
              options={pcOptions.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
          {addMode === "statblock" && (
            <div className="flex flex-col gap-1">
              <input
                value={monsterSearch}
                onChange={(e) => setMonsterSearch(e.target.value)}
                placeholder="Rechercher un monstre…"
                className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
              />
              {monsterSearch && (
                <div className="max-h-40 overflow-y-auto rounded-md border border-edge/40">
                  {filteredMonsters.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMonsterSearch(m.name)}
                      className="block w-full px-2 py-1 text-left text-xs text-ink hover:bg-panel-raised"
                    >
                      {m.name} (FP {m.challengeRatingLabel})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {addMode === "custom" && (
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Nom (ex. Piège à lames)"
              className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
            />
          )}
          <button
            type="button"
            onClick={addParticipant}
            disabled={busy}
            className="self-start rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {participants.length === 0 && (
          <p className="text-xs italic text-ink-muted">Aucun participant — ajoutez-en ci-dessus.</p>
        )}
        {participants.map((p, index) => {
          const isActive = running && index === combat.turn_index;
          const hpMax = p.hp_max ?? 0;
          const hpCurrent = p.hp_current ?? 0;
          const participantConditions = (p.conditions as unknown as string[]) ?? [];
          return (
            <div
              key={p.id}
              className={`flex flex-col gap-2 rounded-md border p-3 ${
                isActive ? "border-accent bg-panel-raised" : "border-edge/60"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  key={`${p.id}-${p.initiative ?? "none"}`}
                  type="number"
                  defaultValue={p.initiative ?? ""}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (Number.isFinite(value) && value !== p.initiative) void patchParticipant(p.id, { initiative: value }, "Initiative modifiée");
                  }}
                  className="mech w-10 rounded-md border border-edge bg-panel-sunken px-1 py-0.5 text-center text-sm text-ink outline-none"
                  title="Initiative"
                />
                <button
                  type="button"
                  onClick={() => rollOne(p.id)}
                  className="text-xs text-ink-muted hover:text-accent"
                  title="Relancer l'initiative"
                >
                  🎲
                </button>
                {p.source_kind === "statblock" && p.rule_key ? (
                  <a
                    href={`/m/${worldSlug}/regles/${p.rule_key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-ink hover:text-accent hover:underline"
                  >
                    {p.label}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-ink">
                    {p.source_kind === "entity" ? "🧑 " : p.source_kind === "custom" ? "❓ " : "💀 "}
                    {p.label}
                  </span>
                )}
                {p.ac !== null && <span className="text-[10px] text-ink-muted">CA {p.ac}</span>}
                <button
                  type="button"
                  onClick={() => removeParticipant(p.id)}
                  className="ml-auto text-xs text-danger hover:underline"
                >
                  ×
                </button>
              </div>

              {hpMax > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-panel-sunken">
                    <div
                      className={`h-full rounded-full transition-all ${hpBarColor(hpCurrent, hpMax)}`}
                      style={{ width: `${Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100))}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    <button type="button" onClick={() => changeHp(p, -1)} className="rounded border border-edge px-1.5 hover:bg-panel-raised">
                      −
                    </button>
                    <span className="mech text-ink">
                      {hpCurrent} / {hpMax}
                    </span>
                    <button type="button" onClick={() => changeHp(p, 1)} className="rounded border border-edge px-1.5 hover:bg-panel-raised">
                      +
                    </button>
                    <span className="ml-2">PV temp.</span>
                    <input
                      key={`${p.id}-temp-${p.temp_hp}`}
                      type="number"
                      defaultValue={p.temp_hp}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value) && value !== p.temp_hp) void changeTempHp(p, value);
                      }}
                      className="mech w-12 rounded border border-edge bg-transparent px-1 py-0.5 text-center text-ink outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                {participantConditions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCondition(p, c)}
                    className="rounded-full border border-gm px-2 py-0.5 text-[10px] text-gm hover:bg-panel-raised"
                    title="Retirer"
                  >
                    {c} ×
                  </button>
                ))}
                <Dropdown
                  value=""
                  onChange={(c) => c && toggleCondition(p, c)}
                  options={[{ value: "", label: "+ Condition" }, ...conditions.map((c) => ({ value: c, label: c }))]}
                />
              </div>
            </div>
          );
        })}
      </div>

      <SavedCombatsList combats={savedCombats} />
    </div>
  );
}

function SavedCombatsList({ combats }: { combats: CombatRow[] }) {
  return (
    <div className="flex flex-col gap-2 border-t border-edge/60 pt-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Mes combats ({combats.length})</span>
      {combats.length === 0 ? (
        <p className="text-xs italic text-ink-muted">Aucun combat pour cette campagne.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {combats.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md border border-edge/60 px-2 py-1.5 text-xs">
              <span className="flex-1 text-ink">{c.name ?? "Combat"}</span>
              <span className="text-ink-muted">{STATUS_LABELS[c.status] ?? c.status}</span>
              <span className="text-ink-muted">{formatDate(c.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
