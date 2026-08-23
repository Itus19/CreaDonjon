"use client";

import { useEffect, useState } from "react";

export interface RuleEntryBlockData {
  blockType: string;
  data: unknown;
}

const EMPTY: Record<string, RuleEntryBlockData[]> = {};

/**
 * Blocs bruts (description, bases de classe...) d'un lot de fiches de regle
 * (assistant de creation de personnage, V2-G1) — recharge des que la liste
 * de cles change, pour rester a jour si le MJ edite la fiche pendant la
 * session (contrairement au resume fige `ai_digest` des chips).
 */
export function useRuleEntryBlocks(worldSlug: string, keys: readonly string[]): Record<string, RuleEntryBlockData[]> {
  const [data, setData] = useState<Record<string, RuleEntryBlockData[]>>(EMPTY);
  const dedupeKey = JSON.stringify([...keys].sort());

  useEffect(() => {
    let cancelled = false;
    const request: Promise<Record<string, RuleEntryBlockData[]>> =
      keys.length === 0
        ? Promise.resolve(EMPTY)
        : fetch(`/api/worlds/${worldSlug}/rule-entry-blocks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keys }),
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((body: Record<string, RuleEntryBlockData[]> | null) => body ?? EMPTY);

    request
      .then((body) => {
        if (!cancelled) setData(body);
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
