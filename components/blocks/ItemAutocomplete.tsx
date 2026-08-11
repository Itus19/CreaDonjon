"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorldRuleEntries } from "./useWorldRuleEntries";
import type { BlockReference } from "@/src/core/schemas/blocks/reference";

const MAX_SUGGESTIONS_PER_SOURCE = 10;
const ITEM_REF_TYPES = ["weapon", "armor", "item"] as const;

interface EntitySearchResult {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

/**
 * Selecteur d'objets a double source (V1-B5, specs/fiche-personnage-
 * interactive.md §5.2, arbitrage-modifications.md §1.1) : un type d'objet
 * (« épée longue ») est une regle, un exemplaire unique avec une histoire
 * (« Durendal ») est une entite — le meme champ interroge les deux, chaque
 * resultat porte un badge d'origine.
 *
 * Les regles sont deja mises en cache par monde (`useWorldRuleEntries`,
 * V1-B2) ; les entites, potentiellement nombreuses, sont cherchees a la
 * frappe (meme route que la recherche de la barre laterale, `searchEntities`
 * — "une requete vide ne vaut pas la peine d'un aller-retour base").
 */
export default function ItemAutocomplete({
  worldSlug,
  value,
  onChange,
  onQueryChange,
  placeholder,
}: {
  worldSlug: string;
  value: BlockReference | null;
  onChange: (ref: BlockReference) => void;
  /** Texte brut tape, pour un appelant qui veut un repli objet-en-ligne quand aucune suggestion n'est choisie (onglet Inventaire, V1-C11). Optionnel, retro-compatible. */
  onQueryChange?: (text: string) => void;
  placeholder?: string;
}) {
  const ruleEntries = useWorldRuleEntries(worldSlug);
  const [query, setQuery] = useState(
    value?.kind === "rule" ? value.key : value?.kind === "entity" ? "" : ""
  );
  const [open, setOpen] = useState(false);
  const [entityResults, setEntityResults] = useState<EntitySearchResult[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/worlds/${worldSlug}/entities-search?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((results: EntitySearchResult[]) => {
          if (!cancelled) setEntityResults(results);
        })
        .catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [worldSlug, query]);

  const ruleSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ruleEntries
      .filter((e) => ITEM_REF_TYPES.includes(e.entryType as (typeof ITEM_REF_TYPES)[number]))
      .filter((e) => q === "" || e.name.toLowerCase().includes(q) || e.key.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS_PER_SOURCE);
  }, [ruleEntries, query]);

  function selectRule(entry: { key: string; name: string }) {
    setQuery(entry.name);
    onChange({ kind: "rule", key: entry.key });
    setOpen(false);
  }

  function selectEntity(entity: EntitySearchResult) {
    setQuery(entity.name);
    onChange({ kind: "entity", id: entity.id });
    setOpen(false);
  }

  // Vide des que la requete redevient vide, sans attendre le prochain fetch
  // (l'effet ne relance rien tant que `query` est vide, `entityResults`
  // resterait sinon perime).
  const visibleEntityResults = query.trim() === "" ? [] : entityResults;
  const hasResults = ruleSuggestions.length > 0 || visibleEntityResults.length > 0;

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onQueryChange?.(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder ?? "Rechercher un objet…"}
        className="w-full rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
      />
      {open && hasResults && (
        <ul className="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-edge-strong bg-panel-raised shadow-2xl">
          {ruleSuggestions.map((entry) => (
            <li key={`rule:${entry.key}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectRule(entry)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-panel"
              >
                <span className="truncate">{entry.name}</span>
                <span className="shrink-0 rounded-full bg-panel px-1.5 py-0.5 text-[10px] text-ink-muted">règle</span>
              </button>
            </li>
          ))}
          {visibleEntityResults.map((entity) => (
            <li key={`entity:${entity.id}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectEntity(entity)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-panel"
              >
                <span className="truncate">{entity.name}</span>
                <span className="shrink-0 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">entité</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !hasResults && query.trim() !== "" && (
        <div className="absolute z-20 mt-1 w-64 rounded-md border border-edge-strong bg-panel-raised px-2.5 py-1.5 text-xs text-ink-muted shadow-2xl">
          Aucun résultat — le nom saisi reste utilisable tel quel.
        </div>
      )}
    </div>
  );
}
