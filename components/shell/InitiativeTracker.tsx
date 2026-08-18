"use client";

import { useEffect, useRef, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import type { CombatActionsSummary, CombatDetail } from "@/src/server/services/combats";
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
  const [combatsList, setCombatsList] = useState<CombatRow[]>(savedCombats);
  const [openActionIds, setOpenActionIds] = useState<Set<string>>(new Set());
  const [actionsById, setActionsById] = useState<Record<string, CombatActionsSummary | "loading">>({});
  const lastAutoOpenedTurnKey = useRef<string | null>(null);

  const running = combat?.status === "running";
  const activeParticipant = running && combat ? participants[combat.turn_index] : null;

  // Ouvre automatiquement le panneau Actions du participant dont c'est le
  // tour (retour explicite de l'utilisateur : "quand le tour arrive a
  // cette entite, cette partie action s'ouvre") — une seule fois par tour,
  // l'utilisateur reste ensuite libre de la refermer sans qu'elle se
  // rouvre toute seule au prochain rendu.
  useEffect(() => {
    if (!combat || !running || !activeParticipant) return;
    const turnKey = `${combat.id}-${combat.round}-${combat.turn_index}`;
    if (lastAutoOpenedTurnKey.current === turnKey) return;
    lastAutoOpenedTurnKey.current = turnKey;
    setOpenActionIds((prev) => (prev.has(activeParticipant.id) ? prev : new Set(prev).add(activeParticipant.id)));
    void loadActions(activeParticipant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.id, combat?.round, combat?.turn_index, running, activeParticipant?.id]);

  async function loadActions(participantId: string) {
    setActionsById((prev) => ({ ...prev, [participantId]: "loading" }));
    const res = await fetch(`/api/campaigns/${campaignId}/combats/${combat?.id}/participants/${participantId}/actions`);
    const data: CombatActionsSummary = res.ok ? await res.json() : { traits: [], actions: [] };
    setActionsById((prev) => ({ ...prev, [participantId]: data }));
  }

  function toggleActions(participantId: string) {
    const willOpen = !openActionIds.has(participantId);
    setOpenActionIds((prev) => {
      const next = new Set(prev);
      if (willOpen) next.add(participantId);
      else next.delete(participantId);
      return next;
    });
    if (willOpen && !actionsById[participantId]) void loadActions(participantId);
  }

  async function loadCombat(combatId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/combats/${combatId}`);
      if (!res.ok) return;
      const detail = (await res.json()) as CombatDetail;
      setCombat(detail.combat);
      setParticipants(detail.participants);
      setOpenActionIds(new Set());
      setActionsById({});
      lastAutoOpenedTurnKey.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function deleteCombatEntry(combatId: string) {
    if (!window.confirm("Supprimer définitivement ce combat ? Cette action est irréversible.")) return;
    await fetch(`/api/campaigns/${campaignId}/combats/${combatId}`, { method: "DELETE" });
    setCombatsList((prev) => prev.filter((c) => c.id !== combatId));
    if (combat?.id === combatId) {
      setCombat(null);
      setParticipants([]);
    }
  }

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
      setCombatsList((prev) => [body, ...prev]);
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

  async function bumpInitiative(participant: CombatParticipantRow, delta: number) {
    const next = (participant.initiative ?? 0) + delta;
    await patchParticipant(participant.id, { initiative: next }, `Initiative ${delta >= 0 ? "+" : ""}${delta}`);
  }

  async function bumpAc(participant: CombatParticipantRow, delta: number) {
    const next = Math.max(0, (participant.ac ?? 10) + delta);
    await patchParticipant(participant.id, { ac: next }, `CA ${delta >= 0 ? "+" : ""}${delta}`);
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
        <SavedCombatsList combats={combatsList} activeCombatId={null} onSelect={loadCombat} onDelete={deleteCombatEntry} />
      </div>
    );
  }

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
              <div className="flex flex-wrap items-center gap-3">
                <div className="mech flex h-14 w-12 shrink-0 flex-col overflow-hidden rounded-lg border-2 border-edge bg-panel-sunken text-ink">
                  <button
                    type="button"
                    onClick={() => bumpInitiative(p, 1)}
                    className="flex h-4 w-full items-center justify-center text-[9px] leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent"
                    title="Augmenter l'initiative"
                  >
                    ▲
                  </button>
                  <input
                    key={`${p.id}-init-${p.initiative ?? "none"}`}
                    type="number"
                    defaultValue={p.initiative ?? ""}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isFinite(value) && value !== p.initiative) void patchParticipant(p.id, { initiative: value }, "Initiative modifiée");
                    }}
                    className="w-full flex-1 border-y border-edge/60 bg-transparent text-center text-lg font-bold text-ink outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    title="Initiative"
                  />
                  <button
                    type="button"
                    onClick={() => bumpInitiative(p, -1)}
                    className="flex h-4 w-full items-center justify-center text-[9px] leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent"
                    title="Diminuer l'initiative"
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => rollOne(p.id)}
                  className="rounded-md border border-edge px-2 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:bg-panel-raised"
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
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-ink-muted">CA</span>
                  <div className="mech flex h-11 w-10 shrink-0 flex-col overflow-hidden rounded-lg border-2 border-edge bg-panel-sunken text-ink">
                    <button
                      type="button"
                      onClick={() => bumpAc(p, 1)}
                      className="flex h-3.5 w-full items-center justify-center text-[8px] leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent"
                      title="Augmenter la CA"
                    >
                      ▲
                    </button>
                    <input
                      key={`${p.id}-ac-${p.ac ?? "none"}`}
                      type="number"
                      defaultValue={p.ac ?? ""}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value) && value !== p.ac) void patchParticipant(p.id, { ac: value }, "CA modifiée");
                      }}
                      className="w-full flex-1 border-y border-edge/60 bg-transparent text-center text-sm font-bold text-ink outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => bumpAc(p, -1)}
                      className="flex h-3.5 w-full items-center justify-center text-[8px] leading-none text-ink-muted transition-colors hover:bg-panel-raised hover:text-accent"
                      title="Diminuer la CA"
                    >
                      ▼
                    </button>
                  </div>
                </div>
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

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleActions(p.id)}
                  className="self-start text-[10px] font-bold uppercase tracking-widest text-ink-muted transition-colors hover:text-accent"
                >
                  {openActionIds.has(p.id) ? "▾" : "▸"} Actions
                </button>
                {openActionIds.has(p.id) && <ParticipantActions summary={actionsById[p.id]} worldSlug={worldSlug} />}
              </div>
            </div>
          );
        })}
      </div>

      <SavedCombatsList combats={combatsList} activeCombatId={combat.id} onSelect={loadCombat} onDelete={deleteCombatEntry} />
    </div>
  );
}

/** Contenu du panneau deroulant "Actions" d'un participant — traits/actions de sa fiche de regle (monstre) ou armes/sorts/ressources de son contexte de jeu (PJ/PNJ), V1-E4. */
function ParticipantActions({ summary, worldSlug }: { summary: CombatActionsSummary | "loading" | undefined; worldSlug: string }) {
  if (!summary || summary === "loading") {
    return <p className="pl-2 text-xs italic text-ink-muted">Chargement…</p>;
  }
  if (summary.traits.length === 0 && summary.actions.length === 0) {
    return <p className="pl-2 text-xs italic text-ink-muted">Aucune action connue pour cette fiche.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-edge/40 bg-panel-sunken p-2.5 pl-3">
      {summary.traits.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Traits</span>
          {summary.traits.map((t, i) => (
            <p key={i} className="text-xs text-ink">
              <span className="font-medium">{t.name}.</span> {t.description}
            </p>
          ))}
        </div>
      )}
      {summary.actions.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-ink-muted">Actions</span>
          {summary.actions.map((a, i) => (
            <p key={i} className="text-xs text-ink">
              <span className="font-medium">
                {a.ruleKey ? (
                  <a href={`/m/${worldSlug}/regles/${a.ruleKey}`} target="_blank" rel="noreferrer" className="hover:text-accent hover:underline">
                    {a.name}
                  </a>
                ) : (
                  a.name
                )}
                .
              </span>{" "}
              {a.description}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function SavedCombatsList({
  combats,
  activeCombatId,
  onSelect,
  onDelete,
}: {
  combats: CombatRow[];
  activeCombatId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-edge/60 pt-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Mes combats ({combats.length})</span>
      {combats.length === 0 ? (
        <p className="text-xs italic text-ink-muted">Aucun combat pour cette campagne.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {combats.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                c.id === activeCombatId ? "border-accent bg-panel-raised" : "border-edge/60"
              }`}
            >
              <button type="button" onClick={() => onSelect(c.id)} className="flex flex-1 items-center gap-2 text-left hover:text-accent">
                <span className="flex-1 text-ink">{c.name ?? "Combat"}</span>
                <span className="text-ink-muted">{STATUS_LABELS[c.status] ?? c.status}</span>
                <span className="text-ink-muted">{formatDate(c.created_at)}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                className="text-danger hover:underline"
                title="Supprimer définitivement"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
