"use client";

import { useEffect, useState } from "react";

export interface RuleEntryBlockData {
  blockType: string;
  data: unknown;
}

const EMPTY: Record<string, RuleEntryBlockData[]> = {};

// Cache module-level, meme motif que `useWorldRuleEntries.ts` : les memes
// cles (ex. la liste complete des sorts) sont redemandees a chaque etape du
// wizard visitee, sans que le contenu ait change entre-temps.
const cache = new Map<string, Record<string, RuleEntryBlockData[]>>();

// Requetes EN COURS — meme raison que `useWorldRuleEntries.ts` (retour
// utilisateur, V2-G1) : sans ce suivi, le prechargement des sorts de
// `CharacterCreatorWizard` et un deuxieme appelant sur la meme cle (React
// StrictMode en dev double le montage, ou deux composants reels) lancent
// chacun leur propre POST identique au lieu de partager la meme reponse.
const inFlight = new Map<string, Promise<Record<string, RuleEntryBlockData[]>>>();

function cacheKey(worldSlug: string, dedupeKey: string): string {
  return `${worldSlug}:${dedupeKey}`;
}

/** Meme raison que `clearWorldRuleEntriesCache` (`useWorldRuleEntries.ts`) : a appeler au changement de ruleset actif d'un monde. */
export function clearRuleEntryBlocksCache(worldSlug: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${worldSlug}:`)) cache.delete(key);
  }
}

/**
 * Blocs bruts (description, bases de classe...) d'un lot de fiches de regle
 * (assistant de creation de personnage, V2-G1) — mis en cache par lot de
 * cles (retour utilisateur : revisiter une etape du wizard redemandait tout
 * a chaque fois, alors que `listRuleEntryBlocksByKeys` reste plus lent que
 * `useWorldRuleEntries` — une liste de sorts pese plus d'une seconde meme
 * une fois le N+1 corrige cote serveur). Invalide au changement de ruleset
 * actif (`clearRuleEntryBlocksCache`), jamais pendant l'edition normale
 * d'une fiche de regle — meme compromis que `useWorldRuleEntries`.
 */
export function useRuleEntryBlocks(worldSlug: string, keys: readonly string[]): Record<string, RuleEntryBlockData[]> {
  const dedupeKey = JSON.stringify([...keys].sort());
  const [data, setData] = useState<Record<string, RuleEntryBlockData[]>>(() => cache.get(cacheKey(worldSlug, dedupeKey)) ?? EMPTY);

  useEffect(() => {
    let cancelled = false;
    const key = cacheKey(worldSlug, dedupeKey);
    const cached = cache.get(key);
    let request: Promise<Record<string, RuleEntryBlockData[]>>;
    if (cached) {
      request = Promise.resolve(cached);
    } else if (keys.length === 0) {
      request = Promise.resolve(EMPTY);
    } else {
      const pending = inFlight.get(key);
      if (pending) {
        request = pending;
      } else {
        request = fetch(`/api/worlds/${worldSlug}/rule-entry-blocks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: Record<string, RuleEntryBlockData[]> | null) => body ?? EMPTY);
        inFlight.set(key, request);
        request.finally(() => {
          if (inFlight.get(key) === request) inFlight.delete(key);
        });
      }
    }

    request
      .then((body) => {
        if (cancelled) return;
        cache.set(key, body);
        setData(body);
      })
      .catch(() => {
        if (!cancelled) setData(EMPTY);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSlug, dedupeKey]);

  return data;
}
