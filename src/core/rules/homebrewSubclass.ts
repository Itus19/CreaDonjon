import type { ReferencePrimitive } from "../schemas/rule-blocks/primitives";
import type { OverrideAction } from "./resolve";

/**
 * V2-N1 — Creer une sous-classe maison.
 *
 * Deux fonctions pures, separees de l'ecriture (`createHomebrewSubclass`,
 * src/server/services/rules.ts) parce que c'est la que se cachent les deux
 * pieges du ticket : un champ vide qui produirait un bloc a moitie rempli,
 * et le tableau `subclass_slot.options` de la classe, qu'un patch JSON
 * Merge Patch REMPLACE en entier au lieu d'y ajouter.
 */

/** V3.1-182 : un sort qu'une aptitude accorde — toujours préparé, et/ou lancé sans emplacement n fois par repos. */
export interface HomebrewGrantedSpellInput {
  key: string;
  alwaysPrepared: boolean;
  freeCast?: { uses: number; refresh: "short_rest" | "long_rest" };
}

export interface HomebrewSubclassFeatureInput {
  name: string;
  level: number;
  description: string;
  spells?: HomebrewGrantedSpellInput[];
}

/** Les sorts d'une aptitude au format du bloc (`zGrantedSpell`) ; un sort sans clé, ou qui n'apporte rien (ni préparé ni gratuit), est écarté. */
function sortsDuBloc(spells: readonly HomebrewGrantedSpellInput[] | undefined) {
  return (spells ?? [])
    .map((s) => ({ ...s, key: s.key.trim() }))
    .filter((s) => s.key !== "" && (s.alwaysPrepared || s.freeCast !== undefined))
    .map((s) => ({ key: s.key, ...(s.alwaysPrepared ? { always_prepared: true } : {}), ...(s.freeCast ? { free_cast: s.freeCast } : {}) }));
}

/**
 * V3.1-185 : une sous-classe qui lance des sorts (Arnaqueur arcanique) — sa
 * caractéristique, son poids au multiclassage (le tiers s'arrondit à
 * l'inférieur, la moitié au supérieur, comme en 2024) et sa table
 * d'emplacements : `counts[i]` emplacements du niveau i + 1.
 */
export interface HomebrewSubclassSpellcastingInput {
  ability: "str" | "dex" | "con" | "int" | "wis" | "cha";
  fraction: "full" | "half" | "third";
  /** V3.1-190 : la liste où choisir les sorts (clé de classe) ; absente : rien à choisir. */
  spellList?: string;
  /** `cantrips`, `prepared` (V3.1-190) : absents, ceux de la ligne d'avant. */
  rows: { level: number; counts: number[]; cantrips?: number; prepared?: number }[];
}

export interface HomebrewSubclassInput {
  name: string;
  parentClassKey: string;
  description: string;
  pageRef: string;
  features: HomebrewSubclassFeatureInput[];
  spellcasting?: HomebrewSubclassSpellcastingInput;
}

/** Le bloc `subclass_spellcasting` ; `null` si la table ne donne aucun emplacement. Les zéros de fin d'une ligne tombent. */
function incantationDuBloc(sc: HomebrewSubclassSpellcastingInput | undefined) {
  if (!sc) return null;
  const triees = sc.rows
    .map((r) => {
      const counts = [...r.counts];
      while (counts.length > 0 && counts[counts.length - 1] === 0) counts.pop();
      return { level: r.level, counts, ...(r.cantrips !== undefined ? { cantrips: r.cantrips } : {}), ...(r.prepared !== undefined ? { prepared: r.prepared } : {}) };
    })
    .sort((a, b) => a.level - b.level);
  // V3.1-190 : une ligne qui ne change que le budget de sorts garde les emplacements de la ligne d'avant.
  const slots: typeof triees = [];
  for (const r of triees) {
    const budget = r.cantrips !== undefined || r.prepared !== undefined;
    if (r.counts.length === 0 && !budget) continue;
    slots.push(r.counts.length === 0 ? { ...r, counts: [...(slots[slots.length - 1]?.counts ?? [])] } : r);
  }
  if (!slots.some((r) => r.counts.length > 0)) return null;
  return {
    ability: sc.ability,
    caster_weight: { fraction: sc.fraction, rounding: sc.fraction === "half" ? "up" : "down" },
    ...(sc.spellList ? { spell_list: sc.spellList } : {}),
    slots,
  };
}

export interface HomebrewSubclassEntry {
  name: string;
  entry_type: "subclass";
  parent_class_key: string;
  blocks: { block_type: "description" | "subclass_features" | "subclass_spellcasting"; data: unknown }[];
}

/**
 * La fiche a importer. Les trois seuls blocs que portent les 12
 * sous-classes du SRD sont `description`, `subclass_features` et
 * `custom_table` — ce dernier est un artefact de l'import, jamais reproduit
 * ici. Un champ vide est OMIS, jamais envoye vide : pas de bloc
 * `description` si ni texte ni page, pas de `page_ref: ""`. Une aptitude
 * sans nom est ecartee ; les autres sont triees par niveau, l'ordre ou on
 * les lit dans un livre.
 */
export function buildHomebrewSubclassEntry(input: HomebrewSubclassInput): HomebrewSubclassEntry {
  const description = input.description.trim();
  const pageRef = input.pageRef.trim();
  const features = input.features
    .map((f) => {
      const spells = sortsDuBloc(f.spells);
      return { name: f.name.trim(), level: f.level, description: f.description.trim(), ...(spells.length > 0 ? { spells } : {}) };
    })
    .filter((f) => f.name.length > 0)
    .sort((a, b) => a.level - b.level);

  const blocks: HomebrewSubclassEntry["blocks"] = [];
  if (description || pageRef) {
    blocks.push({
      block_type: "description",
      data: { segments: description ? [{ text: description }] : [], ...(pageRef ? { page_ref: pageRef } : {}) },
    });
  }
  blocks.push({ block_type: "subclass_features", data: { features } });
  const incantation = incantationDuBloc(input.spellcasting);
  if (incantation) blocks.push({ block_type: "subclass_spellcasting", data: incantation });

  return { name: input.name.trim(), entry_type: "subclass", parent_class_key: input.parentClassKey, blocks };
}

export interface ExistingSlotOverride {
  action: OverrideAction;
  payload: unknown;
  patch: unknown;
}

export interface SubclassSlotWrite {
  action: OverrideAction;
  payload: unknown;
  patch: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * La surcharge a ecrire sur le bloc `subclass_slot` de la classe parente,
 * dans la variante, pour que la nouvelle sous-classe figure dans ses
 * options.
 *
 * `resolvedOptions` : les options telles que la chaine les resout
 * AUJOURD'HUI (base + toutes les surcharges, celle de ce niveau comprise).
 * Le tableau ecrit les reprend toutes : un Merge Patch remplace un tableau,
 * il n'y ajoute jamais.
 *
 * `existing` : la surcharge deja posee sur ce bloc A CE NIVEAU, s'il y en a
 * une. L'upsert de la variante la remplace (une seule ligne par
 * `(entry_key, block_type)`) : on reprend donc ce qu'elle portait —
 * un bloc ajoute reste un bloc ajoute, un patch garde ses autres champs.
 */
export function subclassSlotWrite(
  existing: ExistingSlotOverride | null,
  resolvedOptions: readonly ReferencePrimitive[] | undefined,
  subclassKey: string
): SubclassSlotWrite {
  const current = resolvedOptions ?? [];
  const options: ReferencePrimitive[] = current.some((o) => o.kind === "rule" && o.key === subclassKey)
    ? [...current]
    : [...current, { kind: "rule", key: subclassKey }];

  if (existing && (existing.action === "add_block" || existing.action === "replace_block") && isRecord(existing.payload)) {
    const data = isRecord(existing.payload.data) ? existing.payload.data : {};
    return { action: existing.action, payload: { ...existing.payload, data: { ...data, options } }, patch: null };
  }

  const previousPatch = existing?.action === "patch_block" && isRecord(existing.patch) ? existing.patch : {};
  return { action: "patch_block", payload: null, patch: { ...previousPatch, options } };
}
