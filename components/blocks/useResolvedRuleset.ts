"use client";

import { useEffect, useState } from "react";
import type { ResolvedRuleset } from "@/src/core/rules/sheet";
import type { ArmorData } from "@/src/core/rules/srdMapping";

export interface RemainingChoiceView {
  id: string;
  label: string;
  count: number;
  options: string[];
}

export interface ResolvedRulesetView {
  ruleset: ResolvedRuleset;
  remainingChoices: RemainingChoiceView[];
  equipment: Record<string, ArmorData | null>;
}

export interface RulesetSelection {
  species?: string;
  background?: string;
  classes: { key: string; level: number }[];
  equipmentKeys: string[];
}

const EMPTY: ResolvedRulesetView = { ruleset: { classes: {}, features: {} }, remainingChoices: [], equipment: {} };

function selectionKey(s: RulesetSelection): string {
  return JSON.stringify([s.species, s.background, s.classes, [...s.equipmentKeys].sort()]);
}

/**
 * Assemble un `ResolvedRuleset` reel des que l'espece/l'historique/les
 * classes/l'equipement change (V1-B4) — la fiche derivee, elle, se
 * recalcule a chaque rendu a partir du dernier resultat en cache, sans
 * refetch (`characterSheet()` est pure et instantanee, §4.5).
 */
export function useResolvedRuleset(worldSlug: string, selection: RulesetSelection): ResolvedRulesetView {
  const [data, setData] = useState<ResolvedRulesetView>(EMPTY);
  const dedupeKey = selectionKey(selection);
  const hasAnything = selection.species || selection.background || selection.classes.length > 0;

  useEffect(() => {
    let cancelled = false;
    const request: Promise<ResolvedRulesetView> = hasAnything
      ? fetch(`/api/worlds/${worldSlug}/resolved-ruleset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            species: selection.species,
            background: selection.background,
            classes: selection.classes,
            equipmentKeys: selection.equipmentKeys,
          }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((body: ResolvedRulesetView | null) => body ?? EMPTY)
      : Promise.resolve(EMPTY);

    request.then((body) => {
      if (!cancelled) setData(body);
    }).catch(() => {
      if (!cancelled) setData(EMPTY);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSlug, dedupeKey]);

  return data;
}
