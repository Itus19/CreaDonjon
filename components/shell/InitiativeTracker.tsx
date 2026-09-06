"use client";

import { useEffect, useRef, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import Stepper from "@/components/shared/Stepper";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { MonsterCard } from "@/components/rules/blockContentRenderer";
import ParticipantCharacterSheet from "./ParticipantCharacterSheet";
import type { CombatDetail, ParticipantCharacteristics } from "@/src/server/services/combats";
import type { CombatParticipantRow, CombatRow } from "@/src/server/repos/combats";
import type { EncounterMonsterSummary } from "@/src/server/services/encounters";

const STATUS_LABELS: Record<string, string> = { draft: "Pas engagé", running: "Commencé", ended: "Terminé" };
const STATUS_OPTIONS = [
  { value: "draft", label: "Pas engagé" },
  { value: "running", label: "Commencé" },
  { value: "ended", label: "Terminé" },
];

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
 * Le nom d'un participant `statblock` renvoie aussi vers sa fiche de regle
 * complete (`/regles/[cle]`) dans un nouvel onglet — en plus du derouleur
 * "Caracteristiques" ci-dessous (V1-E4 suite), qui affiche desormais le
 * meme bloc de monstre complet (`MonsterCard`) directement en place, sans
 * aller-retour. Un participant `entity` (PJ/PNJ) affiche de la meme facon
 * sa fiche de personnage complete (`PlayableCharacterSheet`, meme campagne
 * reelle branchee — les jets et changements de PV faits ici comptent pour
 * de vrai).
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
  /** Suppression d'un combat enregistre : `ConfirmDialog` est asynchrone, il faut donc retenir la cible entre le clic et la confirmation (meme motif que `pendingDeleteId` dans EntityBlocks.tsx). */
  const [pendingDeleteCombatId, setPendingDeleteCombatId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddParticipantMode>("statblock");
  const [monsterSearch, setMonsterSearch] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [selectedPcId, setSelectedPcId] = useState(pcOptions[0]?.id ?? "");
  const [combatsList, setCombatsList] = useState<CombatRow[]>(savedCombats);
  const [openCharacteristicsIds, setOpenCharacteristicsIds] = useState<Set<string>>(new Set());
  const [characteristicsById, setCharacteristicsById] = useState<Record<string, ParticipantCharacteristics | "loading">>({});
  const [damageAmount, setDamageAmount] = useState("");
  const [damageTargetId, setDamageTargetId] = useState("");
  const lastAutoOpenedTurnKey = useRef<string | null>(null);

  const running = combat?.status === "running";
  const activeParticipant = running && combat ? participants[combat.turn_index] : null;

  // Ouvre automatiquement le panneau Caracteristiques du participant dont
  // c'est le tour (retour explicite de l'utilisateur : "quand le tour
  // arrive a cette entite, cette partie action s'ouvre") — une seule fois
  // par tour, l'utilisateur reste ensuite libre de la refermer sans qu'elle
  // se rouvre toute seule au prochain rendu.
  useEffect(() => {
    if (!combat || !running || !activeParticipant) return;
    const turnKey = `${combat.id}-${combat.round}-${combat.turn_index}`;
    if (lastAutoOpenedTurnKey.current === turnKey) return;
    lastAutoOpenedTurnKey.current = turnKey;
    setOpenCharacteristicsIds((prev) => (prev.has(activeParticipant.id) ? prev : new Set(prev).add(activeParticipant.id)));
    void loadCharacteristics(activeParticipant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.id, combat?.round, combat?.turn_index, running, activeParticipant?.id]);

  async function loadCharacteristics(participantId: string) {
    setCharacteristicsById((prev) => ({ ...prev, [participantId]: "loading" }));
    const res = await fetch(`/api/campaigns/${campaignId}/combats/${combat?.id}/participants/${participantId}/characteristics`);
    const data: ParticipantCharacteristics = res.ok ? await res.json() : { kind: "none" };
    setCharacteristicsById((prev) => ({ ...prev, [participantId]: data }));
  }

  function toggleCharacteristics(participantId: string) {
    const willOpen = !openCharacteristicsIds.has(participantId);
    setOpenCharacteristicsIds((prev) => {
      const next = new Set(prev);
      if (willOpen) next.add(participantId);
      else next.delete(participantId);
      return next;
    });
    if (willOpen && !characteristicsById[participantId]) void loadCharacteristics(participantId);
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
      setOpenCharacteristicsIds(new Set());
      setCharacteristicsById({});
      lastAutoOpenedTurnKey.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteCombat() {
    const combatId = pendingDeleteCombatId;
    setPendingDeleteCombatId(null);
    if (!combatId) return;
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

  /** Renommage et/ou changement manuel de statut (V1-E4) — le MJ choisit librement parmi les trois statuts en cliquant sur le badge. */
  async function patchCombat(patch: { name?: string | null; status?: string }) {
    if (!combat) return;
    const res = await fetch(`/api/campaigns/${campaignId}/combats/${combat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = (await res.json()) as CombatRow;
      setCombat(updated);
      setCombatsList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    }
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

  /**
   * Application des degats a une cible (V2-G1) — jusqu'ici la V1 ne
   * permettait que de les SUBIR manuellement (le stepper PV de chaque
   * ligne, qui ne sait ajuster que le participant sous les yeux). Un seul
   * controle pour toute la liste, jamais un par ligne : le MJ tape un
   * montant et choisit la cible, quel que soit son `source_kind` (PJ,
   * monstre ou saisie libre n'ont pas tous une arme a "attaquer avec").
   * Les PV temporaires absorbent en premier (regle 5e), le reste retombe
   * sur les PV reels — jamais sous 0.
   */
  async function applyDamage() {
    const amount = Number(damageAmount);
    const target = participants.find((p) => p.id === damageTargetId);
    if (!target || !Number.isFinite(amount) || amount <= 0) return;
    const temp = target.temp_hp ?? 0;
    const absorbedByTemp = Math.min(temp, amount);
    const remaining = amount - absorbedByTemp;
    const hpMax = target.hp_max ?? 0;
    const hpCurrent = target.hp_current ?? 0;
    const nextHp = Math.max(0, Math.min(hpMax, hpCurrent - remaining));
    await patchParticipant(target.id, { hpCurrent: nextHp, tempHp: temp - absorbedByTemp }, `Dégâts subis : ${amount}`);
    setDamageAmount("");
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
        <SavedCombatsList combats={combatsList} activeCombatId={null} onSelect={loadCombat} onDelete={setPendingDeleteCombatId} />
        <ConfirmDialog
          open={pendingDeleteCombatId !== null}
          title="Supprimer ce combat ?"
          message="Le combat et ses participants sont définitivement retirés. Cette action est irréversible."
          confirmLabel="Supprimer"
          danger
          onConfirm={confirmDeleteCombat}
          onCancel={() => setPendingDeleteCombatId(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          key={`name-${combat.id}-${combat.name ?? ""}`}
          type="text"
          defaultValue={combat.name ?? ""}
          placeholder="Combat"
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value !== (combat.name ?? "")) void patchCombat({ name: value || null });
          }}
          className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-ink outline-none transition-colors hover:border-edge/60 focus:border-accent"
        />
        <Dropdown
          value={combat.status}
          onChange={(status) => patchCombat({ status })}
          options={STATUS_OPTIONS}
          aria-label="Statut du combat"
          triggerClassName="rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted outline-none transition-colors hover:bg-panel-raised"
        />
        {running && <span className="text-[10px] uppercase tracking-wider text-ink-muted">· Round {combat.round}</span>}
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
              className="rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              ▶ Go
            </button>
          ) : (
            <button
              type="button"
              onClick={endCombat}
              disabled={busy}
              className="rounded-full bg-danger px-4 py-1.5 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              ■ Stop
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {running && (
        <div className="flex items-center justify-between rounded-md border border-edge/60 bg-panel-sunken px-4 py-2">
          <button type="button" onClick={() => moveTurn("previous")} disabled={busy} className="text-ink-muted transition-opacity hover:text-ink disabled:opacity-50">
            ◁
          </button>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">Tour actuel</div>
            <div className="text-sm font-medium text-accent">{activeParticipant?.label ?? "—"}</div>
          </div>
          <button type="button" onClick={() => moveTurn("next")} disabled={busy} className="text-ink-muted transition-opacity hover:text-ink disabled:opacity-50">
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

      {participants.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge/60 bg-panel-sunken p-3">
          <span className="text-xs font-medium text-ink-muted">Appliquer des dégâts</span>
          <input
            type="number"
            min={1}
            value={damageAmount}
            onChange={(e) => setDamageAmount(e.target.value)}
            placeholder="Montant"
            aria-label="Montant des dégâts"
            className="w-20 rounded-md border border-edge bg-transparent px-2 py-1 text-center text-xs text-ink outline-none"
          />
          <Dropdown
            value={damageTargetId}
            onChange={setDamageTargetId}
            options={[{ value: "", label: "Cible…" }, ...participants.map((p) => ({ value: p.id, label: p.label }))]}
            aria-label="Cible des dégâts"
          />
          <button
            type="button"
            onClick={applyDamage}
            disabled={busy || !damageAmount || !damageTargetId}
            className="rounded-full border border-danger px-3 py-1 text-xs text-danger transition-colors hover:bg-panel-raised disabled:opacity-50"
          >
            Appliquer
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
                <Stepper
                  onIncrement={() => bumpInitiative(p, 1)}
                  onDecrement={() => bumpInitiative(p, -1)}
                  incrementLabel="Augmenter l'initiative"
                  decrementLabel="Diminuer l'initiative"
                  className="w-12"
                >
                  <input
                    key={`${p.id}-init-${p.initiative ?? "none"}`}
                    type="number"
                    defaultValue={p.initiative ?? ""}
                    onBlur={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isFinite(value) && value !== p.initiative) void patchParticipant(p.id, { initiative: value }, "Initiative modifiée");
                    }}
                    className="w-full border-y border-edge/60 bg-transparent text-center text-lg font-bold text-ink outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    title="Initiative"
                  />
                </Stepper>
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
                  <Stepper
                    onIncrement={() => bumpAc(p, 1)}
                    onDecrement={() => bumpAc(p, -1)}
                    incrementLabel="Augmenter la CA"
                    decrementLabel="Diminuer la CA"
                    className="w-10"
                  >
                    <input
                      key={`${p.id}-ac-${p.ac ?? "none"}`}
                      type="number"
                      defaultValue={p.ac ?? ""}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value) && value !== p.ac) void patchParticipant(p.id, { ac: value }, "CA modifiée");
                      }}
                      className="w-full border-y border-edge/60 bg-transparent text-center text-sm font-bold text-ink outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </Stepper>
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
                    <Stepper
                      onIncrement={() => changeHp(p, 1)}
                      onDecrement={() => changeHp(p, -1)}
                      incrementLabel="Augmenter les PV"
                      decrementLabel="Diminuer les PV"
                      className="w-16"
                    >
                      <span className="text-ink">
                        {hpCurrent} / {hpMax}
                      </span>
                    </Stepper>
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
                  onClick={() => toggleCharacteristics(p.id)}
                  className="self-start text-[10px] font-bold uppercase tracking-widest text-ink-muted transition-colors hover:text-accent"
                >
                  {openCharacteristicsIds.has(p.id) ? "▾" : "▸"} Caractéristiques
                </button>
                {openCharacteristicsIds.has(p.id) && (
                  <ParticipantCharacteristicsPanel characteristics={characteristicsById[p.id]} worldSlug={worldSlug} campaignId={campaignId} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <SavedCombatsList combats={combatsList} activeCombatId={combat.id} onSelect={loadCombat} onDelete={setPendingDeleteCombatId} />

      <ConfirmDialog
        open={pendingDeleteCombatId !== null}
        title="Supprimer ce combat ?"
        message="Le combat et ses participants sont définitivement retirés. Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        onConfirm={confirmDeleteCombat}
        onCancel={() => setPendingDeleteCombatId(null)}
      />
    </div>
  );
}

/**
 * Contenu du derouleur "Caracteristiques" d'un participant (V1-E4 suite,
 * retour utilisateur : "nous venons de construire un bloc de monstre
 * complet... on va maintenant l'utiliser tel quel"). Reutilise integralement
 * les fiches deja construites plutot qu'un resume separe : `MonsterCard`
 * (meme composant que `/regles/[cle]`) pour un participant `statblock`,
 * `ParticipantCharacterSheet` (meme `PlayableCharacterSheet` que la fiche du
 * wiki, campagne reelle branchee) pour un participant `entity`.
 */
function ParticipantCharacteristicsPanel({
  characteristics,
  worldSlug,
  campaignId,
}: {
  characteristics: ParticipantCharacteristics | "loading" | undefined;
  worldSlug: string;
  campaignId: string;
}) {
  if (!characteristics || characteristics === "loading") {
    return <p className="pl-2 text-xs italic text-ink-muted">Chargement…</p>;
  }
  if (characteristics.kind === "none") {
    return <p className="pl-2 text-xs italic text-ink-muted">Aucune caractéristique disponible pour cette entrée.</p>;
  }
  return (
    <div className="rounded-md border border-edge/40 bg-panel-sunken p-2.5 pl-3">
      {characteristics.kind === "monster" ? (
        <MonsterCard
          statBlock={characteristics.statBlock}
          traits={characteristics.traits}
          actions={characteristics.actions}
          legendaryActions={characteristics.legendaryActions}
        />
      ) : (
        <ParticipantCharacterSheet worldSlug={worldSlug} campaignId={campaignId} entityId={characteristics.entityId} />
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
