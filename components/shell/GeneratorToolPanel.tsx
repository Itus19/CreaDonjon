"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { GeneratorBlockData } from "@/src/core/schemas/blocks/generator";
import { isProseSlot, PROSE_LENGTH_PRESETS, DEFAULT_PROSE_LENGTH, type ProseLength } from "@/src/core/generators/types";
import { RANDOM_VARIANT_VALUE } from "@/src/core/generators/variants";
import type { GeneratorSlotItem, GeneratorSlotResult, GeneratorToolWindowData } from "@/src/server/services/generators";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";
import type { VisibleBlock } from "@/src/server/services/blocks";
import type { RandomTableBlockData } from "@/src/core/schemas/blocks/randomTable";
import { formatTableEntryPrice } from "@/src/i18n/fr";
import RandomTableBlockEditor from "@/components/blocks/RandomTableBlockEditor";
import RuleEntryAutocomplete from "@/components/blocks/RuleEntryAutocomplete";
import { useOpenEntityLink } from "./useOpenEntityLink";

interface DrawResponse {
  text: string;
  slots: GeneratorSlotResult[];
  resolvedVariant: Record<string, string>;
}

/** Dernier resultat connu d'une section (V2-J2) — remonte au panneau parent pour que "Créer la fiche" puisse combiner toutes les sections actuellement tirees, sans redemander un tirage. `slots` (V2-J-PNJ) porte le texte de CHAQUE emplacement separement — necessaire aux sections promues en bloc structure (personality/quest), qui ne peuvent pas se contenter du texte de section deja assemble. */
export interface SectionResult {
  text: string;
  refs: BlockReference[];
  slots: Record<string, string>;
}

/**
 * Un emplacement a tirage multiple (V2-J9, `count`) s'affiche en tableau
 * plutot qu'en une ligne de texte — `price` est un champ structure de
 * l'entree de table (retour utilisateur : plus encode dans `text`, ex.
 * "Bière brune locale — 4 pc"), jamais reparse ici. Colonnes a largeur
 * fixe (`table-fixed` + `colgroup`) : le prix reste aligne meme si un nom
 * est plus court qu'un autre (retour utilisateur), au lieu de laisser le
 * nom pousser la colonne prix.
 */
function SlotItemsTable({ items }: { items: GeneratorSlotItem[] }) {
  return (
    <table className="w-full table-fixed text-xs">
      <colgroup>
        <col />
        <col className="w-16" />
      </colgroup>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className="border-b border-edge/20 last:border-b-0">
            <td className="truncate py-0.5 pr-2 text-ink">{item.text}</td>
            <td className="whitespace-nowrap py-0.5 text-right text-ink-muted">{formatTableEntryPrice(item.price) ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Une categorie du Menu de taverne (V2-J9, retour utilisateur) — un plat
 * par palier de prix (simple/moyen/cher, un emplacement chacun sur la
 * table du palier correspondant), chacun independamment relancable.
 * Colonnes a largeur fixe (palier/prix/relance) pour un alignement
 * constant quel que soit le nom du plat.
 */
function MenuCategory({
  label,
  tiers,
  slotResults,
  onReroll,
  reloadingKey,
}: {
  label: string;
  tiers: { tierLabel: string; slotKey: string }[];
  slotResults: Record<string, GeneratorSlotResult>;
  onReroll: (slotKey: string) => void;
  reloadingKey: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink">{label}</span>
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-14" />
          <col />
          <col className="w-14" />
          <col className="w-6" />
        </colgroup>
        <tbody>
          {tiers.map(({ tierLabel, slotKey }) => {
            const result = slotResults[slotKey];
            return (
              <tr key={slotKey} className="border-b border-edge/20 last:border-b-0">
                <td className="py-0.5 pr-2 text-ink-muted">{tierLabel}</td>
                <td className="truncate py-0.5 pr-2 text-ink">{result?.text ?? "—"}</td>
                <td className="whitespace-nowrap py-0.5 pr-1 text-right text-ink-muted">{formatTableEntryPrice(result?.price) ?? ""}</td>
                <td className="py-0.5 text-right">
                  <button
                    type="button"
                    onClick={() => onReroll(slotKey)}
                    disabled={reloadingKey === slotKey}
                    className="rounded-full border border-edge px-1.5 py-0.5 text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
                    title={`Relancer (${tierLabel})`}
                  >
                    {reloadingKey === slotKey ? "…" : "↻"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Les 3 emplacements simple/moyen/cher d'une categorie du Menu de taverne (V2-J9) — mêmes 3 libellés partout, seul le prefixe de cle change. */
const MENU_PRICE_TIERS = [
  { tierLabel: "Simple", suffix: "simple" },
  { tierLabel: "Moyen", suffix: "moyen" },
  { tierLabel: "Cher", suffix: "cher" },
] as const;

function menuCategoryTiers(prefix: string): { tierLabel: string; slotKey: string }[] {
  return MENU_PRICE_TIERS.map((t) => ({ tierLabel: t.tierLabel, slotKey: `${prefix}-${t.suffix}` }));
}

/**
 * Un groupe a tirage multiple du Menu de taverne (V2-J9, retour
 * utilisateur — Boissons : 4 avec alcool + 5 sans alcool plutot que 3
 * paliers de prix comme les plats) — libelle, tableau d'items (deja triable
 * par prix a l'ecriture des tables) et sa propre relance.
 */
function MenuMultiSlot({
  label,
  slotKey,
  result,
  onReroll,
  reloadingKey,
}: {
  label: string;
  slotKey: string;
  result: GeneratorSlotResult | undefined;
  onReroll: (slotKey: string) => void;
  reloadingKey: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        <button
          type="button"
          onClick={() => onReroll(slotKey)}
          disabled={reloadingKey === slotKey}
          className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
          title={`Relancer ${label}`}
        >
          {reloadingKey === slotKey ? "…" : "↻"}
        </button>
      </div>
      <SlotItemsTable items={result?.items ?? []} />
    </div>
  );
}

type TableBlock = Omit<VisibleBlock, "data"> & { data: RandomTableBlockData };

/**
 * Modale "Éditer les tables" (V2-J9bis, retour utilisateur — pouvoir
 * ajouter/enlever un plat sans chercher le bloc a la main parmi ~90 sur la
 * fiche "Générateurs de MJ") : liste les tables REELLEMENT tirees par cette
 * section pour la variante actuellement selectionnee (`/api/blocks/[id]/tables`,
 * meme calcul de cle resolue que le tirage lui-meme), un
 * `RandomTableBlockEditor` par table — l'editeur standard de tout bloc
 * `random_table` d'une fiche de wiki, rien de nouveau cote edition.
 * Sauvegarde par debounce (800ms apres la derniere frappe, `tablesRef`
 * pour eviter la fermeture perimee classique d'un debounce adosse a du
 * `useState`) — un `onBlur` seul (essaye d'abord) rate le cas "supprimer
 * une ligne puis fermer la modale aussitot" : retirer le bouton `×` focus
 * ne fait pas toujours sortir le focus du conteneur avant que React
 * demonte la modale. Pas de gestion de conflit de version : un seul MJ
 * edite ce contenu a la fois, une erreur affiche juste un message plutot
 * que de reconcilier deux versions.
 */
function GeneratorTablesModal({
  blockId,
  variant,
  onClose,
}: {
  blockId: string;
  variant: Record<string, string>;
  onClose: () => void;
}) {
  const [tables, setTables] = useState<TableBlock[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Fige la variante a l'ouverture (initialiseur paresseux, jamais recalcule) :
  // le parent recree son objet `variant` a chaque tirage d'une section
  // soeur du meme outil (onResolvedVariant) — sans ce gel, l'effet de
  // chargement ci-dessous se redeclencherait a chaque tirage ailleurs dans
  // le panneau et ecraserait une edition en cours dans cette modale.
  const [snapshotVariant] = useState(variant);
  const tablesRef = useRef<TableBlock[] | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/blocks/${blockId}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant: snapshotVariant }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Impossible de charger les tables.");
        }
        return (await res.json()) as { tables: TableBlock[] };
      })
      .then((body) => {
        if (!cancelled) setTables(body.tables);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Impossible de charger les tables.");
      });
    return () => {
      cancelled = true;
    };
  }, [blockId, snapshotVariant]);

  async function saveTable(id: string) {
    const table = tablesRef.current?.find((t) => t.id === id);
    if (!table) return;
    const res = await fetch(`/api/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: table.version,
        display: table.display,
        data: table.data,
        visibility: { level: table.visibilityLevel, scopeId: table.visibilityScopeId },
      }),
    });
    if (!res.ok) {
      setSaveError(`Échec de la sauvegarde de « ${table.data.key} » — rechargez avant de réessayer.`);
      return;
    }
    setSaveError(null);
    const updated = (await res.json()) as { version: number };
    setTables((prev) => prev?.map((t) => (t.id === id ? { ...t, version: updated.version } : t)) ?? prev);
  }

  function updateTableData(id: string, data: RandomTableBlockData) {
    setTables((prev) => prev?.map((t) => (t.id === id ? { ...t, data } : t)) ?? prev);
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => void saveTable(id), 800);
  }

  function handleClose() {
    // Sauvegarde immediate de toute frappe encore en attente de debounce
    // (ex. supprimer une ligne puis fermer aussitot) plutot que de la
    // perdre silencieusement en demontant la modale.
    for (const id of Object.keys(saveTimers.current)) {
      clearTimeout(saveTimers.current[id]);
      void saveTable(id);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-md border border-edge bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Tables de cette section</span>
          <button type="button" onClick={handleClose} className="text-xs text-ink-muted hover:underline">
            Fermer
          </button>
        </div>
        {loadError && <p className="text-xs text-danger">{loadError}</p>}
        {saveError && <p className="text-xs text-danger">{saveError}</p>}
        {!tables && !loadError && <p className="text-xs italic text-ink-muted">Chargement…</p>}
        {tables && tables.length === 0 && (
          <p className="text-xs italic text-ink-muted">Aucune table trouvée pour cette section avec la sélection actuelle.</p>
        )}
        {tables?.map((table) => (
          <div key={table.id} className="rounded-md border border-edge/60 p-2">
            <p className="mb-2 text-xs font-semibold text-ink-muted">{table.data.key}</p>
            <RandomTableBlockEditor blockId={table.id} data={table.data} onChange={(d) => updateTableData(table.id, d)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Une section d'un outil de generation (V2-J1 Phase 2, style "Maisons
 * Closes" demande par l'utilisateur) : un bouton "Tirer" genere TOUS les
 * emplacements du bloc `generator` de cette section ; une fois tire, un
 * panneau repliable "Détails des tirages" liste chaque emplacement avec son
 * die/resultat et son propre bouton de relance individuelle (`onlySlotKey`,
 * app/api/blocks/[blockId]/generate/route.ts). L'etat des emplacements deja
 * connus (`slotResults`) est conserve cote client — le serveur reste sans
 * etat, chaque relance individuelle lui renvoie les valeurs des AUTRES
 * emplacements pour qu'il recompose le texte complet.
 */
function GeneratorSectionCard({
  blockId,
  label,
  data,
  variant,
  onResult,
  onResolvedVariant,
}: {
  blockId: string;
  label: string;
  data: GeneratorBlockData;
  /** Valeurs choisies pour les axes de variante de l'outil actif (V2-J7), renvoyees a chaque tirage — vide si l'outil n'en declare aucun. */
  variant: Record<string, string>;
  onResult: (result: SectionResult) => void;
  /** Remonte les valeurs REELLEMENT tirees (V2-J7) — un axe laisse sur "Aléatoire" se fige sur le resultat tant que le MJ ne le change pas a la main, plutot que de retirer un axe different a chaque relance individuelle. */
  onResolvedVariant: (resolved: Record<string, string>) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [slotResults, setSlotResults] = useState<Record<string, GeneratorSlotResult>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [proseLength, setProseLength] = useState<ProseLength>(DEFAULT_PROSE_LENGTH);
  const [drawing, setDrawing] = useState(false);
  const [reloadingKey, setReloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tablesModalOpen, setTablesModalOpen] = useState(false);

  const hasProseSlot = data.slots.some(isProseSlot);

  async function draw(onlySlotKey: string | null, knownSlotTexts: Record<string, string>) {
    const res = await fetch(`/api/blocks/${blockId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proseLength, onlySlotKey, knownSlotTexts, variant }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "La génération a échoué.");
    }
    return (await res.json()) as DrawResponse;
  }

  function reportResult(newText: string, newSlotResults: Record<string, GeneratorSlotResult>) {
    const refs = Object.values(newSlotResults).flatMap((s) => s.refs);
    const slots = Object.fromEntries(Object.entries(newSlotResults).map(([key, s]) => [key, s.text]));
    onResult({ text: newText, refs, slots });
  }

  async function handleDrawAll() {
    setDrawing(true);
    setError(null);
    try {
      const result = await draw(null, {});
      const nextSlotResults = Object.fromEntries(result.slots.map((s) => [s.key, s]));
      setText(result.text);
      setSlotResults(nextSlotResults);
      setDetailsOpen(true);
      reportResult(result.text, nextSlotResults);
      if (Object.keys(result.resolvedVariant).length > 0) onResolvedVariant(result.resolvedVariant);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La génération a échoué.");
    } finally {
      setDrawing(false);
    }
  }

  async function handleRerollSlot(slotKey: string) {
    setReloadingKey(slotKey);
    setError(null);
    try {
      const knownSlotTexts = Object.fromEntries(Object.entries(slotResults).map(([k, s]) => [k, s.text]));
      const result = await draw(slotKey, knownSlotTexts);
      const nextSlotResults = { ...slotResults };
      for (const s of result.slots) nextSlotResults[s.key] = s;
      setText(result.text);
      setSlotResults(nextSlotResults);
      reportResult(result.text, nextSlotResults);
      if (Object.keys(result.resolvedVariant).length > 0) onResolvedVariant(result.resolvedVariant);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La relance a échoué.");
    } finally {
      setReloadingKey(null);
    }
  }

  async function handleCopy() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-edge/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <div className="flex items-center gap-2">
          {hasProseSlot && (
            <div className="flex items-center gap-1 text-xs text-ink-muted">
              {PROSE_LENGTH_PRESETS.map((length) => (
                <button
                  key={length}
                  type="button"
                  onClick={() => setProseLength(length)}
                  className={`rounded-full border px-2 py-0.5 transition-colors ${
                    proseLength === length ? "border-accent text-accent" : "border-edge text-ink-muted hover:bg-panel-raised"
                  }`}
                >
                  {length} mots
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setTablesModalOpen(true)}
            title="Voir et modifier les tables tirées par cette section"
            className="rounded-full border border-edge px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
          >
            Éditer les tables
          </button>
          <button
            type="button"
            onClick={handleDrawAll}
            disabled={drawing}
            className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {drawing ? "Tirage…" : "Tirer"}
          </button>
        </div>
      </div>

      {tablesModalOpen && (
        <GeneratorTablesModal blockId={blockId} variant={variant} onClose={() => setTablesModalOpen(false)} />
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      {text && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2 rounded-md border border-edge/60 bg-panel-sunken p-2">
            <p className="text-sm text-ink">{text}</p>
            <button
              type="button"
              onClick={handleCopy}
              title="Copier"
              className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted transition-colors hover:bg-panel-raised"
            >
              {copied ? "Copié" : "Copier"}
            </button>
          </div>

          <button type="button" onClick={() => setDetailsOpen((v) => !v)} className="self-start text-xs text-ink-soft hover:underline">
            {detailsOpen ? "▾" : "▸"} Détails des tirages
          </button>

          {detailsOpen && data.key === "taverne-menu" ? (
            // Layout dedie au Menu (retour utilisateur) : deux colonnes,
            // "Plats" organise en Entrees/Plats/Desserts en 3 emplacements
            // simple/moyen/cher chacun (une FENETRE de richesse autour du
            // palier choisi, `{wealth_below}`/`{wealth}`/`{wealth_above}` —
            // une taverne modeste ne monte jamais jusqu'au luxe, une réputée
            // ne descend jamais au misérable). "Boissons" a part : 4 avec
            // alcool + 5 sans alcool (retour utilisateur), chaque groupe
            // tire d'un coup via `count` (V2-J9) sur le palier choisi.
            <div className="grid grid-cols-2 gap-4 rounded-md border border-edge/40 p-2">
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold text-ink">Plats</span>
                <MenuCategory label="Entrées" tiers={menuCategoryTiers("entree")} slotResults={slotResults} onReroll={handleRerollSlot} reloadingKey={reloadingKey} />
                <MenuCategory label="Plats" tiers={menuCategoryTiers("plat")} slotResults={slotResults} onReroll={handleRerollSlot} reloadingKey={reloadingKey} />
                <MenuCategory label="Desserts" tiers={menuCategoryTiers("dessert")} slotResults={slotResults} onReroll={handleRerollSlot} reloadingKey={reloadingKey} />
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold text-ink">Boissons</span>
                <MenuMultiSlot label="Avec alcool" slotKey="boisson-alcool" result={slotResults["boisson-alcool"]} onReroll={handleRerollSlot} reloadingKey={reloadingKey} />
                <MenuMultiSlot label="Sans alcool" slotKey="boisson-sans-alcool" result={slotResults["boisson-sans-alcool"]} onReroll={handleRerollSlot} reloadingKey={reloadingKey} />
              </div>
            </div>
          ) : (
            detailsOpen && (
              <div className="flex flex-col gap-1 rounded-md border border-edge/40 p-2">
                {data.slots.map((slot) => {
                  const result = slotResults[slot.key];
                  return (
                    <div key={slot.key} className="flex items-start gap-2 border-b border-edge/30 py-1 text-xs last:border-b-0">
                      <span className="w-32 shrink-0 pt-0.5 text-ink-muted">{slot.key}</span>
                      {result?.die && result.rolled !== undefined && (
                        <span className="mech shrink-0 pt-0.5 text-ink-muted">
                          {result.die} → {result.rolled}
                        </span>
                      )}
                      {result?.items && result.items.length > 0 ? (
                        <div className="flex-1">
                          <SlotItemsTable items={result.items} />
                        </div>
                      ) : (
                        <span className="flex-1 pt-0.5 text-ink">
                          {result?.text || "—"}
                          {formatTableEntryPrice(result?.price) && (
                            <span className="ml-2 text-ink-muted">{formatTableEntryPrice(result?.price)}</span>
                          )}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRerollSlot(slot.key)}
                        disabled={reloadingKey === slot.key}
                        className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-ink-muted transition-colors hover:bg-panel-raised disabled:opacity-50"
                        title="Relancer cet emplacement"
                      >
                        {reloadingKey === slot.key ? "…" : "↻"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

/**
 * "Créer la fiche" (V2-J2) : combine les resultats actuellement affiches
 * de toutes les sections DU MEME outil (remontes par `onResult`) et les
 * promeut en une vraie entite via `POST .../mj/generateurs/[toolKey]/promote`
 * — le mecanisme d'ecriture est generique (`promoteToEntity`,
 * src/server/services/promotion.ts), cette carte ne fait qu'assembler ce
 * que le client sait deja. Actif des que la section "nom" a un resultat ;
 * masque entierement si l'outil actif n'est pas configure pour la
 * promotion (`GeneratorToolWindowData.promote` absent).
 */
function PromoteToEntityBar({
  worldSlug,
  toolKey,
  nameSectionKey,
  withCreature,
  results,
}: {
  worldSlug: string;
  toolKey: string;
  nameSectionKey: string;
  withCreature?: boolean;
  results: Record<string, SectionResult>;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ entitySlug: string } | null>(null);
  const [creatureEntryKey, setCreatureEntryKey] = useState("");
  const link = useOpenEntityLink(worldSlug, created?.entitySlug ?? "");

  const ready = Boolean(results[nameSectionKey]?.text.trim());

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldSlug}/mj/generateurs/${toolKey}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: results, creatureEntryKey: creatureEntryKey.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Impossible de créer la fiche.");
        return;
      }
      setCreated({ entitySlug: body.entitySlug });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-edge/60 pt-3">
      {withCreature && (
        <RuleEntryAutocomplete
          worldSlug={worldSlug}
          entryTypes={["monster"]}
          value={creatureEntryKey}
          onChange={setCreatureEntryKey}
          placeholder="Créature du bestiaire (optionnel)"
          className="w-64"
        />
      )}
      <button
        type="button"
        onClick={handleCreate}
        disabled={!ready || creating}
        title={ready ? undefined : "Tirez d'abord le nom."}
        className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {creating ? "Création…" : "Créer la fiche"}
      </button>
      {created && (
        <Link href={link.href} onClick={link.onClick} className="text-xs text-accent hover:underline">
          Voir la fiche →
        </Link>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/**
 * Outil MJ "Générateurs" (V2-J1 Phase 2) — un onglet par outil disponible
 * (`GENERATOR_TOOLS`, src/core/generators/tools.ts ; Phase 1 : Taverne
 * seule), une carte `GeneratorSectionCard` par section. Chaque section est
 * un bloc `generator` distinct sur l'entite "Générateurs de MJ" du monde
 * (auto-provisionnee, jamais creee par cet outil lui-meme). Les resultats
 * de chaque section remontent ici (V2-J2) pour alimenter "Créer la fiche".
 */
export default function GeneratorToolPanel({ worldSlug, tools }: { worldSlug: string; tools: GeneratorToolWindowData[] }) {
  const [activeKey, setActiveKey] = useState(tools[0]?.key ?? null);
  const activeTool = tools.find((t) => t.key === activeKey) ?? null;
  const [resultsByTool, setResultsByTool] = useState<Record<string, Record<string, SectionResult>>>({});
  const [variantByTool, setVariantByTool] = useState<Record<string, Record<string, string>>>({});

  if (tools.length === 0) {
    return <p className="text-sm italic text-ink-muted">Aucun outil de génération configuré pour l&apos;instant.</p>;
  }

  function reportSectionResult(toolKey: string, sectionKey: string, result: SectionResult) {
    setResultsByTool((prev) => ({
      ...prev,
      [toolKey]: { ...prev[toolKey], [sectionKey]: result },
    }));
  }

  function updateVariant(toolKey: string, patch: Record<string, string>) {
    setVariantByTool((prev) => ({ ...prev, [toolKey]: { ...prev[toolKey], ...patch } }));
  }

  return (
    <div className="flex flex-col gap-4">
      {tools.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-edge/60 pb-2">
          {tools.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveKey(t.key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                activeKey === t.key ? "border-accent text-accent" : "border-edge text-ink-soft hover:bg-panel-raised"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTool && (
        <div className="flex flex-col gap-3">
          {activeTool.variants && activeTool.variants.length > 0 && (
            <div className="flex flex-wrap gap-3 border-b border-edge/60 pb-3">
              {activeTool.variants.map((axis) => (
                <label key={axis.key} className="flex flex-col gap-0.5 text-xs text-ink-muted">
                  {axis.label}
                  <select
                    value={variantByTool[activeTool.key]?.[axis.key] ?? axis.options[0]?.key ?? ""}
                    onChange={(e) => updateVariant(activeTool.key, { [axis.key]: e.target.value })}
                    className="rounded-md border border-edge bg-panel-sunken px-2 py-1 text-sm text-ink"
                  >
                    {axis.allowRandom && <option value={RANDOM_VARIANT_VALUE}>Aléatoire</option>}
                    {axis.options.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {activeTool.sections.length === 0 ? (
            <p className="text-sm italic text-ink-muted">
              Aucune section configurée pour « {activeTool.label} » — ajoutez du contenu sur la fiche « Générateurs de
              MJ ».
            </p>
          ) : (
            activeTool.sections.map((section) => (
              <GeneratorSectionCard
                key={section.blockId}
                blockId={section.blockId}
                label={section.label}
                data={section.data}
                variant={variantByTool[activeTool.key] ?? {}}
                onResult={(result) => reportSectionResult(activeTool.key, section.key, result)}
                onResolvedVariant={(resolved) => updateVariant(activeTool.key, resolved)}
              />
            ))
          )}
          {activeTool.promote && (
            <PromoteToEntityBar
              worldSlug={worldSlug}
              toolKey={activeTool.key}
              nameSectionKey={activeTool.promote.nameSectionKey}
              withCreature={activeTool.promote.withCreature}
              results={resultsByTool[activeTool.key] ?? {}}
            />
          )}
        </div>
      )}
    </div>
  );
}
