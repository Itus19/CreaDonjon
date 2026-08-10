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

/** Maitrise ou langue accordee, avec sa source pour affichage (onglet Traits, V1-C6). */
export interface TraitGrantView {
  key: string;
  name: string;
  source: string;
}

export interface ResolvedRulesetView {
  ruleset: ResolvedRuleset;
  remainingChoices: RemainingChoiceView[];
  proficiencies: TraitGrantView[];
  languages: TraitGrantView[];
  equipment: Record<string, ArmorData | null>;
  /** Poids en livres, par cle de regle (encombrement, V1-C4 suite). */
  weight: Record<string, number | null>;
  /** Niveau de sort (0 = tour de magie), par cle de regle (tri Magie, V1-C6). */
  spellLevels: Record<string, number | null>;
}

export interface RulesetSelection {
  species?: string;
  background?: string;
  classes: { key: string; level: number }[];
  equipmentKeys: string[];
  spellKeys: string[];
}

const EMPTY: ResolvedRulesetView = {
  ruleset: { classes: {}, features: {} },
  remainingChoices: [],
  proficiencies: [],
  languages: [],
  equipment: {},
  weight: {},
  spellLevels: {},
};

/**
 * Une cle vide apparait des qu'un objet d'inventaire bascule en "Reference
 * de regle" avant que l'utilisateur ait tape quoi que ce soit (`itemRef`
 * = `{kind:"rule", key:""}`) — `resolveRulesetSchema` (`z.string().min(1)`)
 * la rejette alors, la requete echoue, et sans ce filtre TOUT le ruleset
 * resolu (espece, classes, choix) disparaissait pendant la frappe : un bug
 * reel decouvert en testant V1-B5, pas propre a ce ticket (deja present
 * dans l'ancien `CharacterSheetPreview`, meme calcul d'`equipmentKeys`).
 */
function nonEmptyKeys(keys: readonly string[]): string[] {
  return keys.filter((k) => k.trim() !== "");
}

function selectionKey(s: RulesetSelection): string {
  return JSON.stringify([
    s.species,
    s.background,
    s.classes,
    [...nonEmptyKeys(s.equipmentKeys)].sort(),
    [...nonEmptyKeys(s.spellKeys)].sort(),
  ]);
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
            equipmentKeys: nonEmptyKeys(selection.equipmentKeys),
            spellKeys: nonEmptyKeys(selection.spellKeys),
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
