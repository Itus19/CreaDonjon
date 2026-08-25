"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDesktop } from "./DesktopContext";

export interface PaletteEntity {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

const DEBOUNCE_MS = 200;

/**
 * ⌘K — recherche et navigation (specs/coquille-et-design.md §5, §8).
 * Etat vide : filtrage local instantane sur les entites deja chargees par
 * le layout. Requete non vide : recherche serveur via `search_fr`
 * (docs/BACKLOG.md V0-06, nom/alias/resume, insensible aux accents),
 * debattue pour ne pas faire un aller-retour a chaque frappe. Le filtrage
 * local sert aussi de resultat immediat pendant que la requete serveur
 * est en vol, pour eviter un flash vide.
 */
export default function CommandPalette({
  worldId,
  worldSlug,
  entities,
}: {
  worldId: string;
  worldSlug: string;
  entities: PaletteEntity[];
}) {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [serverResults, setServerResults] = useState<PaletteEntity[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const desktop = useDesktop();

  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return entities.slice(0, 8);
    return entities.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, entities]);

  const results = query.trim() === "" ? localResults : (serverResults ?? localResults);

  useEffect(() => {
    const trimmed = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmed === "") return;

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/search?worldId=${encodeURIComponent(worldId)}&q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setServerResults(data);
        })
        .catch(() => {
          // Requete annulee (nouvelle frappe) ou erreur reseau : le filtrage
          // local reste affiche, pas de raison de faire echouer la palette.
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, worldId]);

  function openPalette() {
    setQuery("");
    setServerResults(null);
    setActiveIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setQuery("");
        setServerResults(null);
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
    if (desktop) {
      desktop.openRef({ kind: "entity", key: slug });
    } else {
      window.location.href = `/m/${worldSlug}/f/${slug}`;
    }
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
        {t("rechercher")} <kbd className="font-mech text-xs">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-scrim pt-[15vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={t("paletteDeCommandes")}
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
          placeholder={t("rechercherEntite")}
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
            <li className="px-4 py-3 text-sm text-ink-muted">{t("aucunResultat")}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
