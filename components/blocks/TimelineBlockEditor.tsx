"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Dropdown from "@/components/shared/Dropdown";
import VisibilityPill from "@/components/shared/VisibilityPill";
import GameDateInput from "@/components/shared/GameDateInput";
import AxeBande from "@/components/entities/timeline/AxeBande";
import { computeSortKey } from "@/src/core/calendar/sortKey";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { useWorldCalendar } from "@/components/shared/useWorldCalendar";
import type { GameDate } from "@/src/core/calendar/types";
import { TIMELINE_ENTRY_KINDS, type TimelineBlockData, type TimelineEntry, type TimelineEntryKind } from "@/src/core/schemas/blocks/timeline";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { teinteGenre, type TeinteGenre } from "@/lib/ui/axeBande";

/** Pastille de genre : contour et texte dans la teinte du genre (jetons de la charte). */
const PASTILLE_GENRE: Record<TeinteGenre, string> = {
  success: "border-success/45 text-success",
  danger: "border-danger/45 text-danger",
  gm: "border-gm/55 text-gm",
  players: "border-players/50 text-players",
  neutre: "border-edge text-ink-muted",
};

function blankEntry(date: GameDate = { year: 0, month: null, day: null, precision: "year", end: null, label: null }): TimelineEntry {
  return {
    id: crypto.randomUUID(),
    date,
    kind: "custom",
    title: "",
    summary: "",
    visibility: { level: "public", scopeId: null },
  };
}

/**
 * Bloc `timeline` (V2-H2, specs/wiki-blocs.md §3) : entrees en ligne, une
 * chronologie parmi d'autres possibles sur la meme entite (vie d'un
 * personnage, histoire d'un monde...). Edition generique (onChange, meme
 * patron que les aspirations de `personality`) — aucun journal a ecrire
 * ici, contrairement aux poles psyche : une entree de timeline est du
 * contenu redactionnel, pas une mesure amortie.
 *
 * PAS de formulaire "brouillon" separe pour l'ajout : une premiere version
 * en avait un, avec un bouton "Ajouter" qui demontait le formulaire (donc
 * le champ alors focalise) au clic. `handleBlockBlur` (EntityBlocks.tsx)
 * ne sauvegarde QUE si le focus quitte reellement le conteneur du bloc —
 * une demolition du champ focalise ne declenche pas cet evenement de facon
 * fiable, l'entree disparaissait silencieusement au rechargement reel.
 * Corrige en ajoutant l'entree directement (comme les aspirations),
 * jamais via un etat local intermediaire qui disparait avant la sauvegarde.
 * Seule la promotion en entite passe par une route dediee (effet de bord
 * reel : cree une fiche).
 *
 * V3.1-68 : en tête, l'axe en bande (`AxeBande`) ; dessous, UNE LIGNE par
 * événement — genre en pastille, date, titre, visibilité en pastille
 * (`VisibilityPill`, qui écrit tout de suite par `onEnregistrer`), et
 * « → en faire une fiche » (la route de promotion existante). L'événement
 * choisi se déplie : date, résumé, suppression.
 */
export default function TimelineBlockEditor({
  blockId,
  version,
  worldSlug,
  data,
  otherEntities,
  onChange,
  onBlockRefreshed,
  onEnregistrer,
  nonAuteur = false,
}: {
  blockId: string;
  version: number;
  worldSlug: string;
  data: TimelineBlockData;
  otherEntities: OtherEntityOption[];
  onChange: (data: TimelineBlockData) => void;
  onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void;
  /** Écrit TOUT DE SUITE ce contenu (même chemin que l'enregistrement du bloc) et répond `true` si le serveur l'a accepté. Absent (éditeur plein écran) : la pastille ne fait que changer le brouillon. */
  onEnregistrer?: (data: TimelineBlockData) => Promise<boolean>;
  /** Le lecteur n'est pas l'auteur du bloc : « Privé » ne lui est pas proposé. */
  nonAuteur?: boolean;
}) {
  const t = useTranslations("fiche.chronologie");
  const activeCalendar = useWorldCalendar(worldSlug);
  const [entityLookup, setEntityLookup] = useState<Record<string, { name: string; slug: string }>>(() =>
    Object.fromEntries(otherEntities.map((e) => [e.id, { name: e.name, slug: e.slug }]))
  );
  const [pendingPromote, setPendingPromote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // La donnee la plus fraiche : une pastille qui attend le serveur ne doit pas
  // ecraser, en revenant en arriere, ce qui a ete tape pendant ce temps.
  const dataRef = useRef(data);
  // Synchronise la reference avant l'affichage : ce n'est pas un chargement, rien n'est lu.
  useLayoutEffect(() => {
    dataRef.current = data;
  });

  const sorted = [...data.entries].sort(
    (a, b) => computeSortKey(a.date, activeCalendar) - computeSortKey(b.date, activeCalendar)
  );

  function updateEntry(id: string, patch: Partial<TimelineEntry>) {
    onChange({ ...data, entries: data.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }
  function removeEntry(id: string) {
    onChange({ ...data, entries: data.entries.filter((e) => e.id !== id) });
  }
  function addEntry() {
    onChange({ ...data, entries: [...data.entries, blankEntry()] });
  }

  /** Cree depuis l'axe (toucher = point, glisser = periode avec `date.end`) — meme chemin d'ecriture que `addEntry`, avec une date deja calculee. */
  function createEntryAt(date: GameDate) {
    const entry = blankEntry(date);
    onChange({ ...data, entries: [...data.entries, entry] });
    setSelectedEntryId(entry.id);
    requestAnimationFrame(() => rowRefs.current[entry.id]?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function selectEntry(id: string) {
    setSelectedEntryId(id);
    rowRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /**
   * Visibilite d'UN evenement : l'ecran suit aussitot, le bloc est ecrit par
   * le chemin d'enregistrement habituel, et l'ancienne valeur revient si le
   * serveur refuse. `true` si l'ecriture a reussi (la pastille l'annonce).
   */
  async function changerVisibilite(id: string, niveau: string): Promise<boolean> {
    const avant = dataRef.current.entries.find((e) => e.id === id)?.visibility;
    if (!avant) return false;
    const visibility = { level: niveau as TimelineEntry["visibility"]["level"], scopeId: null };
    const apres: TimelineBlockData = {
      ...dataRef.current,
      entries: dataRef.current.entries.map((e) => (e.id === id ? { ...e, visibility } : e)),
    };
    onChange(apres);
    if (!onEnregistrer) return true;
    const ok = await onEnregistrer(apres);
    if (!ok) {
      onChange({
        ...dataRef.current,
        entries: dataRef.current.entries.map((e) => (e.id === id ? { ...e, visibility: avant } : e)),
      });
    }
    return ok;
  }

  async function promote(entry: TimelineEntry) {
    setPendingPromote(entry.id);
    setError(null);
    const res = await fetch(`/api/blocks/${blockId}/timeline-promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, entryId: entry.id }),
    });
    setPendingPromote(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? t("erreurFiche"));
      return;
    }
    const body = (await res.json()) as {
      entity: { id: string; name: string; slug: string };
      block: { id: string; data: unknown; version: number };
    };
    setEntityLookup((prev) => ({ ...prev, [body.entity.id]: { name: body.entity.name, slug: body.entity.slug } }));
    onBlockRefreshed(body.block);
  }

  return (
    <div className="flex flex-col gap-4">
      <AxeBande
        entries={data.entries}
        calendar={activeCalendar}
        selectedEntryId={selectedEntryId}
        onSelectEntry={selectEntry}
        onCreateEntry={createEntryAt}
      />

      <div className="flex flex-col gap-2">
        {sorted.length === 0 && <p className="text-sm italic text-ink-muted">{t("aucun")}</p>}
        {sorted.map((entry) => {
          const linkedEntity = entry.ref?.kind === "entity" ? entityLookup[entry.ref.id] : undefined;
          const choisi = entry.id === selectedEntryId;
          const nom = entry.title || t("sansTitre");
          return (
            <div
              key={entry.id}
              ref={(el) => {
                rowRefs.current[entry.id] = el;
              }}
              onFocusCapture={() => setSelectedEntryId(entry.id)}
              onClick={() => setSelectedEntryId(entry.id)}
              className={`flex flex-col gap-2 rounded-xl border px-2 py-2 transition-colors ${
                choisi ? "border-accent/60 bg-accent/5" : "border-edge"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {/* Colonne de largeur fixe : sans elle, les titres se décalaient selon la longueur du genre. */}
                <span className="w-28 shrink-0">
                <Dropdown
                  value={entry.kind}
                  options={TIMELINE_ENTRY_KINDS.map((k) => ({ value: k, label: t(`genres.${k}`) }))}
                  onChange={(v) => updateEntry(entry.id, { kind: v as TimelineEntryKind })}
                  aria-label={t("genre", { titre: nom })}
                  size="sm"
                  triggerClassName={`rounded-full border bg-transparent px-2 py-0.5 text-xs ${PASTILLE_GENRE[teinteGenre(entry.kind)]}`}
                />
                </span>
                <span className="w-24 shrink-0 font-mono text-xs text-ink-muted">{formatGameDate(entry.date, activeCalendar)}</span>
                <input
                  value={entry.title}
                  onChange={(e) => updateEntry(entry.id, { title: e.target.value })}
                  placeholder={t("titrePlaceholder")}
                  aria-label={t("titreLabel")}
                  className="min-w-40 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
                />
                <VisibilityPill
                  niveau={entry.visibility.level}
                  onChange={(niveau) => changerVisibilite(entry.id, niveau)}
                  objet={nom}
                  sansPrive={nonAuteur}
                />
                {entry.ref ? (
                  linkedEntity && (
                    <a
                      href={`/m/${worldSlug}/f/${linkedEntity.slug}`}
                      aria-label={t("voirFicheLabel", { nom: linkedEntity.name })}
                      className="text-xs text-link-entity hover:underline"
                    >
                      {t("voirFiche", { nom: linkedEntity.name })}
                    </a>
                  )
                ) : (
                  <button
                    type="button"
                    // Pas de `disabled` pendant l'envoi : désactiver le bouton qui a le
                    // focus le lui retire, la carte s'enregistre alors « à la perte du
                    // focus » en même temps, et la promotion arrive avec une version
                    // périmée (409). Le bouton se dit occupé et ignore le second clic.
                    onClick={() => {
                      if (pendingPromote === null) void promote(entry);
                    }}
                    disabled={entry.title.trim() === ""}
                    aria-disabled={pendingPromote === entry.id}
                    aria-busy={pendingPromote === entry.id}
                    aria-label={t("faireFicheLabel", { titre: nom })}
                    className="text-xs text-link-entity transition-colors hover:underline disabled:opacity-50 aria-disabled:opacity-50"
                  >
                    {pendingPromote === entry.id ? t("faireFicheEnCours") : t("faireFiche")}
                  </button>
                )}
              </div>

              {entry.summary && !choisi && <p className="text-xs text-ink-soft">{entry.summary}</p>}

              {choisi && (
                <div className="flex flex-col gap-2 border-t border-edge/60 pt-2">
                  <GameDateInput calendar={activeCalendar} value={entry.date} onChange={(date) => updateEntry(entry.id, { date })} />
                  {!entry.ref && (
                    <textarea
                      value={entry.summary}
                      onChange={(e) => updateEntry(entry.id, { summary: e.target.value })}
                      placeholder={t("resumePlaceholder")}
                      aria-label={t("resumeLabel", { titre: nom })}
                      rows={2}
                      className="bg-transparent text-sm text-ink outline-none"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    aria-label={t("supprimerLabel", { titre: nom })}
                    className="self-start text-xs text-danger hover:underline"
                  >
                    {t("supprimer")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="button"
        onClick={addEntry}
        className="self-start rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
      >
        {t("ajouter")}
      </button>
    </div>
  );
}
