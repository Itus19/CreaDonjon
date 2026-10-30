import { resolveDeclaredModifiers, type DeclaredModifier, type FeatureSpell, type ResolvedFeature } from "./sheet";
import type { ChoiceSource } from "./choices";
import type { ChoiceGrant, GrantedSpellData } from "../schemas/rule-blocks/choices";

/**
 * Les aptitudes d'une sous-classe (V3.1-117, ADR 0046). Elles vivent dans le
 * bloc `subclass_features` de la fiche de sous-classe, pas dans des fiches
 * propres : chacune porte son niveau de classe, et, quand la règle le
 * permet, ses modificateurs, ses sorts toujours préparés et ses choix.
 */
export interface SubclassFeatureData {
  name: string;
  level: number;
  modifiers?: readonly DeclaredModifier[];
  spells?: readonly GrantedSpellData[];
  grants?: readonly ChoiceGrant[];
}

export interface SubclassInfo {
  key: string;
  label: string;
  classKey: string;
  classLevel: number;
}

/** Identifiant stable d'une aptitude d'après son nom (« Elemental Affinity » → `elemental-affinity`). Il entre dans la clé des choix stockés. */
export function subclassFeatureSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Les aptitudes atteintes (niveau de classe suffisant) deviennent des
 * aptitudes de la fiche si elles ont un effet chiffré, et des sources de
 * choix si elles en portent. Une aptitude purement descriptive ne produit
 * rien : la fiche calculée n'en dépend pas. Couche 3 (classe), source
 * `class:<classe>` : l'onglet Traits les range sous leur classe.
 */
export function subclassFeatures(sub: SubclassInfo, entries: readonly SubclassFeatureData[]): { features: ResolvedFeature[]; sources: ChoiceSource[] } {
  const features: ResolvedFeature[] = [];
  const sources: ChoiceSource[] = [];
  for (const entry of entries) {
    if (entry.level > sub.classLevel) continue;
    const slug = subclassFeatureSlug(entry.name);
    const label = `${sub.label} — ${entry.name}`;
    const source = `class:${sub.classKey}`;
    const modifiers = resolveDeclaredModifiers(entry.modifiers ?? [], `subclass:${sub.key}:${slug}`, label, 3);
    const spells: FeatureSpell[] = (entry.spells ?? []).map((s) => ({
      key: s.key,
      atLevel: s.at_level ?? entry.level,
      classKey: sub.classKey,
      alwaysPrepared: s.always_prepared === true,
      ...(s.free_cast ? { freeCast: s.free_cast } : {}),
    }));
    if (modifiers.length > 0 || spells.length > 0) {
      features.push({ key: `subclass:${sub.key}:${slug}`, label, source, modifiers, ...(spells.length > 0 ? { spells } : {}) });
    }
    if (entry.grants && entry.grants.length > 0) {
      sources.push({ key: `${sub.key}.${slug}`, label, layer: 3, grants: entry.grants, classKey: sub.classKey, origin: "class" });
    }
  }
  return { features, sources };
}
