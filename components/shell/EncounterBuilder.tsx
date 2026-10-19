"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Dropdown from "@/components/shared/Dropdown";
import FeuilleDuBas from "@/components/shared/FeuilleDuBas";
import { encounterBudget, encounterCost, type EncounterBudgetBand, type EncounterBudgetRow } from "@/src/core/rules/encounter";
import type { EncounterMonsterSummary } from "@/src/server/services/encounters";
import { CREATURE_TYPE_LABELS_FR } from "@/src/i18n/fr";
import type { EncounterPartyMember } from "@/src/server/services/encounterWorkshop";
import type { CampaignEncounterParticipant, CampaignEncounterRow } from "@/src/server/repos/encounters";
import {
  budgetDuGroupe,
  filtrerCatalogue,
  membresComptes,
  niveauMoyenArrondi,
  typeDeBase,
  typesDuCatalogue,
} from "@/lib/ui/atelierRencontres";

const BAND_OPTIONS: { value: EncounterBudgetBand; label: string }[] = [
  { value: "low", label: "Faible" },
  { value: "moderate", label: "Modérée" },
  { value: "high", label: "Élevée" },
];
const PARTY_SIZE_OPTIONS = Array.from({ length: 7 }, (_, i) => i + 2).map((n) => ({ value: String(n), label: String(n) }));
const PARTY_LEVEL_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1).map((n) => ({ value: String(n), label: String(n) }));

const PANNEAU = "flex flex-col gap-2 rounded-[18px] border border-edge bg-panel p-3 backdrop-blur-[var(--blur)]";
const TITRE_SECTION = "text-[10px] font-bold uppercase tracking-widest text-ink-muted";
const BOUTON = "rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised disabled:opacity-50";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function estPalier(valeur: string | null): valeur is EncounterBudgetBand {
  return valeur === "low" || valeur === "moderate" || valeur === "high";
}

/**
 * Outil MJ "Générateur de rencontres" (V3.1-44) : l'atelier en trois colonnes.
 * Gauche : le groupe (vrais PJ de la campagne), la difficulté visée, "Mes
 * rencontres". Centre : le catalogue du ruleset. Droite : la barre de budget,
 * la rencontre en cours et ses gestes. Les colonnes s'empilent quand la
 * fenêtre est étroite (requête de conteneur) ; sur téléphone le groupe passe
 * en pastilles et le catalogue en feuille du bas.
 *
 * Le budget d'un palier est la somme des parts calculées par le serveur
 * (`party[].shares`) des PJ présents : aucun calcul de règle ici. Seul le
 * repli (campagne sans PJ) garde `encounterBudget` sur un groupe hypothétique.
 */
/** Le type de base d'une créature en français (table du SRD FR, plus la nuée) ; une base inconnue s'affiche telle quelle. */
function typeLabel(type: string): string {
  const base = typeDeBase(type);
  return base === "swarm" ? "Nuée" : (CREATURE_TYPE_LABELS_FR[base] ?? base);
}

export default function EncounterBuilder({
  worldSlug,
  campaignId,
  budgetTable,
  budgetIsFallback,
  monsters,
  initialSavedEncounters,
  party,
}: {
  worldSlug: string;
  campaignId: string;
  budgetTable: EncounterBudgetRow[] | null;
  /** `true` si `budgetTable` vient du SRD 2024 de reference plutot que du ruleset propre de la campagne (V1-E3 : disponible quel que soit le ruleset, sur demande explicite de l'utilisateur). */
  budgetIsFallback: boolean;
  monsters: EncounterMonsterSummary[];
  initialSavedEncounters: CampaignEncounterRow[];
  party: EncounterPartyMember[];
}) {
  const router = useRouter();
  const avecGroupe = party.length > 0;
  const [launching, setLaunching] = useState(false);
  const [absents, setAbsents] = useState<ReadonlySet<string>>(new Set());
  // Repli (campagne sans PJ) : groupe hypothétique saisi à la main.
  const [partySize, setPartySize] = useState(4);
  const [partyLevel, setPartyLevel] = useState(1);
  const [band, setBand] = useState<EncounterBudgetBand>("moderate");
  const [participants, setParticipants] = useState<CampaignEncounterParticipant[]>([]);
  const [search, setSearch] = useState("");
  const [typeFiltre, setTypeFiltre] = useState<string | null>(null);
  const [catalogueOuvert, setCatalogueOuvert] = useState(false);
  const [name, setName] = useState("Rencontre");
  const [savedEncounters, setSavedEncounters] = useState(initialSavedEncounters);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const types = useMemo(() => typesDuCatalogue(monsters), [monsters]);
  const filteredMonsters = useMemo(() => filtrerCatalogue(monsters, search, typeFiltre), [monsters, search, typeFiltre]);

  const presents = useMemo(() => membresComptes(party, absents), [party, absents]);
  const niveauxPresents = presents.map((m) => m.level);
  const effectifEnvoye = avecGroupe ? presents.length : partySize;
  const niveauEnvoye = avecGroupe ? niveauMoyenArrondi(niveauxPresents) : partyLevel;
  const groupeVide = avecGroupe && presents.length === 0;

  const paliers = useMemo(() => (avecGroupe ? budgetDuGroupe(party, absents) : null), [avecGroupe, party, absents]);
  let budget: number | null = null;
  if (paliers) {
    budget = groupeVide ? null : paliers[band];
  } else if (budgetTable) {
    try {
      budget = encounterBudget(Array.from({ length: partySize }, () => partyLevel), band, budgetTable);
    } catch (erreur) {
      console.error("Calcul du budget de rencontre impossible", erreur);
      budget = null;
    }
  }
  const cost = encounterCost(participants);
  const barColor = budget === null ? "bg-ink-muted" : cost > budget ? "bg-danger" : cost >= budget * 0.75 ? "bg-gm" : "bg-accent";
  // Échelle de la barre : le palier Élevé (traits repères) ou le budget seul en repli.
  const echelle = Math.max(paliers ? paliers.high : (budget ?? 0), cost, 1);
  const barWidth = budget ? Math.min(100, (cost / echelle) * 100) : 0;
  const libelleBande = BAND_OPTIONS.find((b) => b.value === band)?.label ?? "";

  function basculerPresent(entityId: string) {
    setAbsents((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(entityId)) suivant.delete(entityId);
      else suivant.add(entityId);
      return suivant;
    });
  }

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

  /** Rouvre une rencontre sauvegardée : sa composition et sa difficulté, sans requête. */
  function reopenEncounter(e: CampaignEncounterRow) {
    setParticipants(e.participants);
    setName(e.name);
    if (estPalier(e.band)) setBand(e.band);
    setError(null);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/encounters/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          avecGroupe
            ? { partySize: effectifEnvoye, partyLevel: niveauEnvoye, partyLevels: niveauxPresents, band }
            : { partySize, partyLevel, band }
        ),
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
        body: JSON.stringify({ name, partySize: effectifEnvoye, partyLevel: niveauEnvoye, band, participants }),
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

  const selecteurDifficulte = (
    <div className="flex gap-1" role="group" aria-label="Difficulté visée">
      {BAND_OPTIONS.map((b) => (
        <button
          key={b.value}
          type="button"
          onClick={() => setBand(b.value)}
          aria-pressed={band === b.value}
          className={`flex-1 rounded-full border px-2 py-1 text-xs transition-colors ${
            band === b.value ? "border-accent bg-panel-raised text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );

  const catalogue = (
    <>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher un monstre…"
        aria-label="Rechercher un monstre"
        className="rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
      />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer par type">
        {[null, ...types].map((t) => (
          <button
            key={t ?? "tous"}
            type="button"
            onClick={() => setTypeFiltre(t)}
            aria-pressed={typeFiltre === t}
            className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
              typeFiltre === t ? "border-accent text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
            }`}
          >
            {t === null ? "Tous" : typeLabel(t)}
          </button>
        ))}
      </div>
      <div className="flex max-h-96 flex-col overflow-y-auto rounded-md border border-edge/60">
        {filteredMonsters.length === 0 && <p className="p-3 text-xs italic text-ink-muted">Aucun monstre trouvé.</p>}
        {filteredMonsters.map((m) => (
          <div key={m.key} className="flex items-center gap-2 border-b border-edge/40 px-2 py-1.5 last:border-b-0">
            <span className="flex flex-1 flex-col text-sm text-ink">
              {m.name}
              <span className="text-[10px] text-ink-muted">{typeLabel(m.type)}</span>
            </span>
            <span className="text-[10px] text-ink-muted">FP {m.challengeRatingLabel}</span>
            <span className="mech text-[10px] text-ink-muted">{m.xp} PX</span>
            <button type="button" onClick={() => addMonster(m)} aria-label={`Ajouter ${m.name}`} className={BOUTON}>
              +
            </button>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="@container flex flex-col gap-4">
      {!budgetTable && !avecGroupe && (
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
      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Colonne de gauche : le groupe, la difficulté, mes rencontres. */}
        <div className="flex flex-col gap-4">
          <section className={PANNEAU}>
            <span className={TITRE_SECTION}>{avecGroupe ? "Le groupe" : "Le groupe hypothétique"}</span>
            {avecGroupe ? (
              <>
                {/* Ordinateur et tablette : une case par PJ. */}
                <div className="hidden flex-col gap-1 @md:flex">
                  {party.map((m) => {
                    const inconnu = m.shares === null;
                    const present = !absents.has(m.entityId);
                    return (
                      <label
                        key={m.entityId}
                        className={`flex items-center gap-2 rounded-md px-1 py-1 text-sm ${inconnu ? "opacity-50" : "cursor-pointer hover:bg-panel-raised"}`}
                      >
                        <input
                          type="checkbox"
                          checked={present && !inconnu}
                          disabled={inconnu}
                          onChange={() => basculerPresent(m.entityId)}
                        />
                        <span className="flex-1 truncate text-ink">{m.name}</span>
                        <span className="text-xs text-ink-muted">{inconnu ? "niveau inconnu" : `niv. ${m.level}`}</span>
                      </label>
                    );
                  })}
                  <span className="text-[11px] text-ink-muted">Décocher un absent : le budget suit.</span>
                </div>
                {/* Téléphone : pastilles, toucher bascule présent / absent. */}
                <div className="flex flex-wrap gap-1.5 @md:hidden">
                  {party.map((m) => {
                    const inconnu = m.shares === null;
                    const present = !absents.has(m.entityId) && !inconnu;
                    return (
                      <button
                        key={m.entityId}
                        type="button"
                        disabled={inconnu}
                        aria-pressed={present}
                        onClick={() => basculerPresent(m.entityId)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                          present ? "border-accent bg-panel-raised text-ink" : "border-edge text-ink-muted line-through"
                        }`}
                      >
                        <span className="inline-block max-w-[9rem] truncate align-bottom">{m.name}</span> · {inconnu ? "niveau inconnu" : m.level}
                      </button>
                    );
                  })}
                  <span className="w-full text-[11px] text-ink-muted">Toucher un absent pour le retirer : le budget suit.</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-ink-muted">Aucun PJ dans la campagne : groupe hypothétique.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                    PJ
                    {/* Le libelle visible vit dans un `<label>`, qui ne nomme que les
                        controles natifs : sans `aria-label`, un lecteur d'ecran
                        n'annoncerait que la valeur choisie. */}
                    <Dropdown
                      value={String(partySize)}
                      options={PARTY_SIZE_OPTIONS}
                      onChange={(v) => setPartySize(Number(v))}
                      aria-label="Nombre de personnages joueurs"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                    Niveau
                    <Dropdown
                      value={String(partyLevel)}
                      options={PARTY_LEVEL_OPTIONS}
                      onChange={(v) => setPartyLevel(Number(v))}
                      aria-label="Niveau du groupe"
                    />
                  </label>
                </div>
              </>
            )}
          </section>

          <section className={`${PANNEAU} hidden @md:flex`}>
            <span className={TITRE_SECTION}>Difficulté visée</span>
            {selecteurDifficulte}
          </section>

          <section className={`${PANNEAU} hidden @md:flex`}>
            <span className={TITRE_SECTION}>Mes rencontres ({savedEncounters.length})</span>
            {savedEncounters.length === 0 ? (
              <p className="text-xs italic text-ink-muted">Aucune rencontre sauvegardée pour cette campagne.</p>
            ) : (
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {savedEncounters.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => reopenEncounter(e)}
                    className="flex items-center gap-2 rounded-md border border-edge/60 px-2 py-1.5 text-left text-xs transition-colors hover:bg-panel-raised"
                  >
                    <span className="flex flex-1 flex-col">
                      <span className="text-ink">{e.name}</span>
                      <span className="text-ink-muted">
                        {e.party_size} PJ niv. {e.party_level} · {formatDate(e.created_at)}
                      </span>
                    </span>
                    <span className="text-ink-muted">{e.participants.reduce((sum, p) => sum + p.count, 0)} créatures</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Colonne du centre : le catalogue (ordinateur et tablette ; sur téléphone, feuille du bas). */}
        <section className={`${PANNEAU} hidden @md:flex`}>
          <span className={TITRE_SECTION}>Catalogue de monstres</span>
          {catalogue}
        </section>

        {/* Colonne de droite : budget, rencontre en cours, gestes. */}
        <div className="flex flex-col gap-4">
          <section className={PANNEAU}>
            <div className="@md:hidden">{selecteurDifficulte}</div>
            {budget !== null ? (
              <div className="flex flex-col gap-1.5">
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-muted">
                  <span>
                    <span className="mech text-sm text-ink">{cost}</span> / {budget} PX · {libelleBande}
                  </span>
                  {avecGroupe && (
                    <span>
                      {presents.length} PJ présent{presents.length > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-panel-sunken">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
                  {paliers &&
                    [paliers.low, paliers.moderate, paliers.high].map((p, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className="absolute top-0 h-full w-px bg-ink-muted"
                        style={{ left: `${Math.min(100, (p / echelle) * 100)}%` }}
                      />
                    ))}
                </div>
                {paliers && (
                  <p className="text-[11px] text-ink-muted">
                    {`Faible jusqu'à ${paliers.low} · Modérée jusqu'à ${paliers.moderate} · Élevée jusqu'à ${paliers.high} PX`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-ink-muted">
                {groupeVide ? "Aucun PJ présent avec un niveau connu : pas de budget." : "Budget indisponible."}
              </p>
            )}
          </section>

          <section className={PANNEAU}>
            <div className="flex items-center gap-2">
              <span className={`${TITRE_SECTION} flex-1`}>Rencontre en cours</span>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || groupeVide || (!avecGroupe && !budgetTable)}
                className="rounded-full border border-accent px-3 py-1 text-xs text-accent transition-colors hover:bg-panel-raised disabled:opacity-50"
              >
                {generating ? "Génération…" : "Génération aléatoire"}
              </button>
            </div>
            <div className="flex min-h-24 flex-col overflow-y-auto rounded-md border border-edge/60">
              {participants.length === 0 && (
                <p className="p-3 text-xs italic text-ink-muted">
                  Aucune créature : ajoutez-en depuis le catalogue, ou « Génération aléatoire ».
                </p>
              )}
              {participants.map((p) => (
                <div key={p.entryKey} className="flex items-center gap-2 border-b border-edge/40 px-2 py-1.5 last:border-b-0">
                  <span className="flex flex-1 flex-col text-sm text-ink">
                    {p.name}
                    <span className="text-[10px] text-ink-muted">
                      FP {p.challengeRatingLabel} · {p.xp} PX chacun
                    </span>
                  </span>
                  <button type="button" onClick={() => changeCount(p.entryKey, -1)} aria-label={`Un ${p.name} de moins`} className={BOUTON}>
                    −
                  </button>
                  <span className="mech w-5 text-center text-xs text-ink">{p.count}</span>
                  <button type="button" onClick={() => changeCount(p.entryKey, 1)} aria-label={`Un ${p.name} de plus`} className={BOUTON}>
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.entryKey)}
                    aria-label={`Retirer ${p.name}`}
                    className="text-xs text-danger hover:underline"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setCatalogueOuvert(true)} aria-haspopup="dialog" className={`${BOUTON} self-start @md:hidden`}>
              + Ajouter une créature
            </button>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-32 flex-1 rounded-md border border-edge bg-transparent px-2 py-1 text-xs text-ink outline-none"
              placeholder="Nom de la rencontre"
              aria-label="Nom de la rencontre"
            />
            <button type="button" onClick={handleSave} disabled={saving || participants.length === 0 || groupeVide} className={BOUTON}>
              {saving ? "Enregistrement…" : "Sauvegarder"}
            </button>
            <button type="button" onClick={handleReset} className={`${BOUTON} text-ink-soft`}>
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={handleLaunchCombat}
              disabled={launching || participants.length === 0}
              className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {launching ? "Lancement…" : "Lancer le combat"}
            </button>
          </div>
        </div>
      </div>

      {catalogueOuvert && (
        <FeuilleDuBas titre="Catalogue de monstres" titreVisible onFermer={() => setCatalogueOuvert(false)}>
          <div className="flex flex-col gap-2 pb-2">{catalogue}</div>
        </FeuilleDuBas>
      )}
    </div>
  );
}
