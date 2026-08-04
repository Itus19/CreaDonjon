"use client";

import { useMemo, useState } from "react";
import { useWorldRuleEntries } from "./useWorldRuleEntries";

const MAX_SUGGESTIONS = 20;

/**
 * Champ hybride texte libre + suggestions (V1-B2, complement post-critere) :
 * la cle reste modifiable a la main (§B5 "avertir, ne pas interdire" — une
 * cle qui ne matche rien n'est jamais bloquee, juste non suggeree), mais
 * taper "nain" propose "Nain" (dwarf) des la premiere lettre. Generique par
 * `entryTypes` : reutilisable pour toute reference de regle future, pas
 * seulement `character`/`inventory`.
 */
export default function RuleEntryAutocomplete({
  worldSlug,
  entryTypes,
  value,
  onChange,
  placeholder,
  className,
}: {
  worldSlug: string;
  entryTypes: readonly string[];
  value: string;
  onChange: (key: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const entries = useWorldRuleEntries(worldSlug);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  // Reste synchronise si la valeur change depuis l'exterieur (ex. bascule de
  // nature d'objet dans l'inventaire), sans ecraser la frappe en cours :
  // ajustement pendant le rendu (pattern React "adjusting state when a prop
  // changes"), pas un effet — evite un rendu intermediaire perimee.
  const [trackedValue, setTrackedValue] = useState(value);
  if (value !== trackedValue) {
    setTrackedValue(value);
    setQuery(value);
  }

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => entryTypes.includes(e.entryType))
      .filter((e) => q === "" || e.name.toLowerCase().includes(q) || e.key.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [entries, entryTypes, query]);

  function select(entry: { key: string; name: string }) {
    setQuery(entry.key);
    onChange(entry.key);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        className={
          className ?? "w-full rounded-md border border-edge bg-transparent px-2 py-1 text-sm text-ink outline-none"
        }
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full min-w-[12rem] overflow-auto rounded-md border border-edge-strong bg-panel-raised shadow-2xl">
          {suggestions.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                // Empeche le blur de l'input de fermer la liste avant que le clic ne soit traite.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(entry)}
                className="block w-full truncate px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-panel"
              >
                {entry.name} <span className="text-ink-muted">({entry.key})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && suggestions.length === 0 && query.trim() !== "" && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-edge-strong bg-panel-raised px-2.5 py-1.5 text-xs text-ink-muted shadow-2xl">
          Aucune suggestion
        </div>
      )}
    </div>
  );
}
