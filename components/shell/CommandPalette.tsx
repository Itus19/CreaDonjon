"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface PaletteEntity {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

/**
 * ⌘K — recherche et navigation (specs/coquille-et-design.md §5, §8).
 * Filtrage cote client sur la liste des entites du monde courant : la
 * recherche server-side complete (V0-06) n'est pas un prealable a une
 * palette de commandes utilisable des maintenant.
 */
export default function CommandPalette({
  worldSlug,
  entities,
}: {
  worldSlug: string;
  entities: PaletteEntity[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return entities.slice(0, 8);
    return entities.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, entities]);

  function openPalette() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setQuery("");
        setActiveIndex(0);
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function updateQuery(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  function navigateTo(slug: string) {
    setOpen(false);
    router.push(`/m/${worldSlug}/f/${slug}`);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) navigateTo(target.slug);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPalette}
        className="flex items-center gap-2 rounded-md border border-edge bg-panel-sunken px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-panel-raised"
      >
        Rechercher <kbd className="font-mech text-xs">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-scrim pt-[15vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-edge-strong bg-panel-raised shadow-2xl"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Rechercher une entité…"
          className="w-full border-b border-edge bg-transparent px-4 py-3 text-ink outline-none"
        />
        <ul>
          {results.map((entity, index) => (
            <li key={entity.id}>
              <button
                type="button"
                onClick={() => navigateTo(entity.slug)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-panel text-accent" : "text-ink-soft"
                }`}
              >
                <span>{entity.name}</span>
                <span className="text-xs text-ink-muted">{entity.entity_kind}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-muted">Aucun résultat.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
