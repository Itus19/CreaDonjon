"use client";

import { useEffect, useRef, useState } from "react";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";

export interface RefLinkTarget {
  kind: "entity" | "rule";
  id?: string;
  key?: string;
  name: string;
}

const MAX_RESULTS_PER_KIND = 8;

/**
 * Recherche combinee fiches + regles pour "Lier à la Fiche" (V2.1-1, retour
 * utilisateur : les liens doivent pouvoir cibler une fiche OU une entree de
 * regle, ex. "Tieffeline" -> la race). Meme discipline que `BubbleSelect`
 * (pas de portail : la bulle Tiptap vit dans le sous-arbre DOM du bloc, un
 * menu porte vers `document.body` deplacerait le focus hors de ce sous-arbre
 * et declencherait une sauvegarde prematuree du bloc au clic).
 */
export default function RefLinkPopover({
  worldSlug,
  otherEntities,
  onSelect,
  onClose,
}: {
  worldSlug: string;
  otherEntities: OtherEntityOption[];
  onSelect: (target: RefLinkTarget) => void;
  onClose: () => void;
}) {
  const ruleEntries = useWorldRuleEntries(worldSlug);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const entityMatches = otherEntities
    .filter((e) => q === "" || e.name.toLowerCase().includes(q))
    .slice(0, MAX_RESULTS_PER_KIND)
    .map((e) => ({ kind: "entity" as const, id: e.id, name: e.name, sub: e.entity_kind }));
  const ruleMatches = ruleEntries
    .filter((r) => q === "" || r.name.toLowerCase().includes(q))
    .slice(0, MAX_RESULTS_PER_KIND)
    .map((r) => ({ kind: "rule" as const, key: r.key, name: r.name, sub: r.entryType }));
  const results = [...entityMatches, ...ruleMatches];

  return (
    <div
      ref={rootRef}
      className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-edge-strong bg-panel-raised shadow-2xl"
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher une fiche ou une règle…"
        className="w-full border-b border-edge bg-transparent px-2.5 py-1.5 text-xs text-ink outline-none"
      />
      <div className="max-h-56 overflow-auto">
        {results.length === 0 && <p className="px-2.5 py-1.5 text-xs text-ink-muted">Aucun résultat</p>}
        {results.map((r) => (
          <button
            key={`${r.kind}:${r.kind === "entity" ? r.id : r.key}`}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              onSelect(
                r.kind === "entity" ? { kind: "entity", id: r.id, name: r.name } : { kind: "rule", key: r.key, name: r.name }
              )
            }
            className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:bg-panel"
          >
            <span className="truncate">{r.name}</span>
            <span className="shrink-0 text-[10px] uppercase text-ink-muted">{r.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
