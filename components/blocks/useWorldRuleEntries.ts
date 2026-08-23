"use client";

import { useEffect, useState } from "react";
import type { RuleEntrySummary } from "@/src/server/services/rules";

// Cache module-level, pas de state global (Context) : plusieurs champs
// d'autocompletion sur la meme fiche partagent le meme fetch sans provider
// a brancher — la liste ne change pas pendant une session d'edition.
const cache = new Map<string, RuleEntrySummary[]>();

/**
 * A appeler des que le ruleset actif d'un monde change (V1-C5,
 * `RulesetSelector.tsx`) — bug reel trouve en verifiant l'assistant de
 * creation de personnage : `router.refresh()` revalide les composants
 * serveur (la liste de regles de `/regles`), mais jamais ce cache
 * module-level cote client, qui continuait de servir la liste de l'ancien
 * ruleset tant que la page n'etait pas rechargee entierement.
 */
export function clearWorldRuleEntriesCache(worldSlug: string): void {
  cache.delete(worldSlug);
}

/** Charge une fois la liste complete des regles du monde, reutilisee par tous les champs d'autocompletion de la page (V1-B2). */
export function useWorldRuleEntries(worldSlug: string): RuleEntrySummary[] {
  const [entries, setEntries] = useState<RuleEntrySummary[]>(() => cache.get(worldSlug) ?? []);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(worldSlug);
    const request: Promise<RuleEntrySummary[] | null> = cached
      ? Promise.resolve(cached)
      : fetch(`/api/worlds/${worldSlug}/rule-entries`)
          .then((res) => (res.ok ? res.json() : null))
          .then((body: { entries: RuleEntrySummary[] } | null) => body?.entries ?? null);

    request
      .then((entries) => {
        if (cancelled || !entries) return;
        cache.set(worldSlug, entries);
        setEntries(entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [worldSlug]);

  return entries;
}
