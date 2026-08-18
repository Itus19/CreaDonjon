"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "@/components/shared/Dropdown";
import { encounterBudget, encounterCost, type EncounterBudgetBand, type EncounterBudgetRow } from "@/src/core/rules/encounter";
import type { EncounterMonsterSummary } from "@/src/server/services/encounters";
import type { CampaignEncounterParticipant, CampaignEncounterRow } from "@/src/server/repos/encounters";

const BAND_OPTIONS = [
  { value: "low", label: "Faible" },
  { value: "moderate", label: "Modérée" },
  { value: "high", label: "Élevée" },
];
const PARTY_SIZE_OPTIONS = Array.from({ length: 7 }, (_, i) => i + 2).map((n) => ({ value: String(n), label: String(n) }));
const PARTY_LEVEL_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1).map((n) => ({ value: String(n), label: String(n) }));

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Outil MJ "Générateur de rencontres" (V1-E3, refonte sur mockups de
 * l'utilisateur, specs/outils-mj.md §4) : catalogue de monstres du ruleset
 * a gauche, rencontre en cours de composition a droite, barre de budget en
 * direct (memes fonctions pures que l'ancien bloc d'entite, `encounterBudget`/
 * `encounterCost`), solveur aleatoire cote serveur, "Mes combats" persiste
 * dans `campaign_encounters`. "Lancer le combat" (V1-E4) cree le combat
 * depuis la composition courante et navigue vers l'ecran Initiative.
 */
export default function EncounterBuilder({
  worldSlug,
  campaignId,
  budgetTable,
  budgetIsFallback,
  monsters,
  initialSavedEncounters,
}: {
  worldSlug: string;
  campaignId: string;
  budgetTable: EncounterBudgetRow[] | null;
  /** `true` si `budgetTable` vient du SRD 2024 de reference plutot que du ruleset propre de la campagne (V1-E3 : disponible quel que soit le ruleset, sur demande explicite de l'utilisateur). */
  budgetIsFallback: boolean;
  monsters: EncounterMonsterSummary[];
  initialSavedEncounters: CampaignEncounterRow[];
}) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const [partySize, setPartySize] = useState(4);
  const [partyLevel, setPartyLevel] = useState(1);
  const [band, setBand] = useState<EncounterBudgetBand>("moderate");
  const [participants, setParticipants] = useState<CampaignEncounterParticipant[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("Rencontre");
  const [savedEncounters, setSavedEncounters] = useState(initialSavedEncounters);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredMonsters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return monsters;
    return monsters.filter((m) => m.name.toLowerCase().includes(q));
  }, [monsters, search]);

  let budget: number | null = null;
  if (budgetTable) {
    try {
      budget = encounterBudget(Array.from({ length: partySize }, () => partyLevel), band, budgetTable);
    } catch {
      budget = null;
    }
  }
  const cost = encounterCost(participants);
  const barColor = budget === null ? "bg-ink-muted" : cost > budget ? "bg-danger" : cost >= budget * 0.75 ? "bg-gm" : "bg-accent";
  const barWidth = budget ? Math.min(100, (cost / budget) * 100) : 0;

  function addMonster(m: EncounterMonsterSummary) {
    setParticipants((prev) => {
      const existing = prev.find((p) => p.entryKey === m.key);
      if (existing) return prev.map((p) => (p.entryKey === m.key ? { ...p, count: p.count + 1 } : p));
      return [...prev, { entryKey: m.key, name: m.name, challengeRatingLabel: m.challengeRatingLabel, xp: m.xp, count: 1 }];
    });
  }
  function changeCount(entryKey: string, delta: number) {
    setParticipants((prev) =>
      prev.flatMap((p) => {
        if (p.entryKey !== entryKey) return [p];
        const count = p.count + delta;
        return count <= 0 ? [] : [{ ...p, count }];
      })
    );
  }
  function removeParticipant(entryKey: string) {
    setParticipants((prev) => prev.filter((p) => p.entryKey !== entryKey));
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/encounters/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partySize, partyLevel, band }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "La génération a échoué.");
        return;
      }
      setParticipants(body.participants);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/encounters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, partySize, partyLevel, band, participants }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "L'enregistrement a échoué.");
        return;
      }
      setSavedEncounters((prev) => [body, ...prev]);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setParticipants([]);
    setName("Rencontre");
    setError(null);
  }

  /** "Lancer le combat" (V1-E4) — cree le combat depuis la composition en cours (monstres seulement, les PJ s'ajoutent ensuite depuis l'ecran Initiative), puis y navigue directement. */
  async function handleLaunchCombat() {
    setLaunching(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/combats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          monsters: participants.map((p) => ({ entryKey: p.entryKey, label: p.name, count: p.count })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Impossible de lancer le combat.");
        return;
      }
      router.push(`/m/${worldSlug}/mj/initiative?campagne=${campaignId}`);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-edge/60 bg-panel-sunken p-3">
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          PJ
          <Dropdown value={String(partySize)} options={PARTY_SIZE_OPTIONS} onChange={(v) => setPartySize(Number(v))} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          Niveau
          <Dropdown value={String(partyLevel)} options={PARTY_LEVEL_OPTIONS} onChange={(v) => setPartyLevel(Number(v))} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          Difficulté
          <Dropdown value={band} options={BAND_OPTIONS} onChange={(v) => setBand(v as EncounterBudgetBand)} />
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !budgetTable}
          className="ml-auto rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-panel-raised disabled:opacity-50"
        >
          {generating ? "Génération…" : "Génération aléatoire"}
        </button>
      </div>

      {!budgetTable && (
        <p className="text-xs text-ink-muted">
          Budget de rencontre non disponible : aucune table de budget de PX connue, même en repli sur le SRD 2024 de
          référence.
        </p>
      )}
      {budgetTable && budgetIsFallback && (
        <p className="text-xs text-ink-muted">
          Le ruleset de cette campagne ne republie pas la table de budget de PX — valeurs empruntées au SRD 2024 de
          référence.
        </p>
      )}
      {budgetTable && budget !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel-sunken">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
          </div>
          <p className="text-xs text-ink-muted">
            <span className="mech text-ink">{cost}</span> / {budget} PX
          </p>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Catalogue de monstres</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
          />
          <div className="flex max-h-96 flex-col overflow-y-auto rounded-md border border-edge/60">
            {filteredMonsters.length === 0 && (
              <p className="p-3 text-xs italic text-ink-muted">Aucun monstre trouvé.</p>
            )}
            {filteredMonsters.map((m) => (
              <div key={m.key} className="flex items-center gap-2 border-b border-edge/40 px-2 py-1.5 last:border-b-0">
                <span className="flex-1 text-sm text-ink">{m.name}</span>
                <span className="text-[10px] text-ink-muted">FP {m.challengeRatingLabel}</span>
                <span className="mech text-[10px] text-ink-muted">{m.xp} PX</span>
                <button
                  type="button"
                  onClick={() => addMonster(m)}
                  className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink transition-colors hover:bg-panel-raised"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Rencontre en cours</span>
          <div className="flex min-h-24 flex-col overflow-y-auto rounded-md border border-edge/60">
            {participants.length === 0 && (
              <p className="p-3 text-xs italic text-ink-muted">Aucune créature — ajoutez-en depuis le catalogue.</p>
            )}
            {participants.map((p) => (
              <div key={p.entryKey} className="flex items-center gap-2 border-b border-edge/40 px-2 py-1.5 last:border-b-0">
                <span className="flex-1 text-sm text-ink">{p.name}</span>
                <span className="text-[10px] text-ink-muted">FP {p.challengeRatingLabel}</span>
                <button
                  type="button"
                  onClick={() => changeCount(p.entryKey, -1)}
                  className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink transition-colors hover:bg-panel-raised"
                >
                  −
                </button>
                <span className="mech w-5 text-center text-xs text-ink">{p.count}</span>
                <button
                  type="button"
                  onClick={() => changeCount(p.entryKey, 1)}
                  className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink transition-colors hover:bg-panel-raised"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeParticipant(p.entryKey)}
                  className="text-xs text-danger hover:underline"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
              placeholder="Nom de la rencontre"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || participants.length === 0}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Sauvegarder"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-edge px-3 py-1 text-xs text-ink-soft transition-colors hover:bg-panel-raised"
            >
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={handleLaunchCombat}
              disabled={launching || participants.length === 0}
              className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-panel transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {launching ? "Lancement…" : "Lancer le combat"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-edge/60 pt-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">
          Mes combats ({savedEncounters.length})
        </span>
        {savedEncounters.length === 0 ? (
          <p className="text-xs italic text-ink-muted">Aucune rencontre sauvegardée pour cette campagne.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {savedEncounters.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-md border border-edge/60 px-2 py-1.5 text-xs">
                <span className="flex-1 text-ink">{e.name}</span>
                <span className="text-ink-muted">
                  {e.party_size} PJ niv. {e.party_level}
                </span>
                <span className="text-ink-muted">{e.participants.reduce((sum, p) => sum + p.count, 0)} créatures</span>
                <span className="text-ink-muted">{formatDate(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
