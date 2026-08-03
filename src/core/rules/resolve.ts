/**
 * Resolution de surcharge (SCHEMA.md §9.4, V1-A4) : applique une liste
 * ordonnee de `ruleset_overrides` sur une entree resolue de base. Pure —
 * aucune lecture, aucune remontee de chaine de heritage. L'appelant (couche
 * service) fournit les surcharges deja dans l'ordre d'application (racine
 * -> feuille de la chaine) et deja bornees par la profondeur/le cycle
 * (resolveRulesetChain, cote service).
 */

export const OVERRIDE_ACTIONS = [
  "add_entry",
  "disable_entry",
  "replace_entry",
  "add_block",
  "patch_block",
  "replace_block",
  "remove_block",
] as const;
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

export interface OverrideInput {
  block_type: string | null;
  action: OverrideAction;
  payload: unknown;
  patch: unknown;
}

export interface ResolvableBlock {
  block_type: string;
  display: unknown;
  data: unknown;
  display_order: number;
}

export interface ResolvableEntry {
  entry_key: string;
  entry_type: string;
  blocks: ResolvableBlock[];
}

export interface ResolvedEntry extends ResolvableEntry {
  disabled: boolean;
  /** Types de blocs touches par au moins une surcharge — sert au badge "modifiee dans ta variante". */
  modifiedBlockTypes: string[];
}

export const MAX_RULESET_CHAIN_DEPTH = 8;

export class RulesetChainDepthError extends Error {
  constructor() {
    super(`Chaine de ruleset trop profonde (max ${MAX_RULESET_CHAIN_DEPTH})`);
  }
}

export class RulesetChainCycleError extends Error {
  constructor(rulesetId: string) {
    super(`Cycle detecte dans la chaine de ruleset (retour sur ${rulesetId})`);
  }
}

/**
 * JSON Merge Patch (RFC 7386) : un patch objet fusionne champ par champ
 * (recursivement pour les sous-objets), `null` sur une cle la retire, toute
 * autre valeur (tableau, scalaire, null au niveau racine) remplace
 * entierement la cible. Implementation dediee plutot qu'une dependance :
 * l'algorithme tient en une dizaine de lignes et n'a rien d'un interprete
 * general (CLAUDE.md regle 5 ne s'applique pas, mais l'esprit — pas de
 * mecanisme plus puissant que necessaire — si).
 */
export function jsonMergePatch(target: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;

  const base: Record<string, unknown> =
    target && typeof target === "object" && !Array.isArray(target) ? { ...(target as Record<string, unknown>) } : {};

  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === null) {
      delete base[key];
    } else {
      base[key] = jsonMergePatch(base[key], value);
    }
  }
  return base;
}

/**
 * Applique les surcharges dans l'ordre donne, chacune sur le resultat de la
 * precedente. `null` en entree (aucune entree de base dans ce ruleset) n'est
 * un resultat valide que si une surcharge `add_entry` fournit une entree
 * entiere — sinon il n'y a simplement rien a resoudre.
 */
export function applyOverrides(base: ResolvableEntry | null, overrides: OverrideInput[]): ResolvedEntry | null {
  let entry: ResolvableEntry | null = base;
  let disabled = false;
  const modifiedBlockTypes = new Set<string>();

  for (const ov of overrides) {
    if (ov.action === "disable_entry") {
      disabled = true;
      continue;
    }

    if (ov.action === "replace_entry") {
      entry = ov.payload as ResolvableEntry;
      disabled = false;
      continue;
    }

    if (ov.action === "add_entry") {
      if (!entry) entry = ov.payload as ResolvableEntry;
      continue;
    }

    // Actions de bloc : rien a modifier sans entree de base sur laquelle agir.
    if (!entry) continue;

    if (ov.action === "add_block") {
      const newBlock = ov.payload as ResolvableBlock;
      entry = { ...entry, blocks: [...entry.blocks, newBlock] };
      modifiedBlockTypes.add(newBlock.block_type);
      continue;
    }

    if (ov.action === "remove_block") {
      entry = { ...entry, blocks: entry.blocks.filter((b) => b.block_type !== ov.block_type) };
      if (ov.block_type) modifiedBlockTypes.add(ov.block_type);
      continue;
    }

    if (ov.action === "replace_block") {
      const replacement = ov.payload as ResolvableBlock;
      entry = { ...entry, blocks: entry.blocks.map((b) => (b.block_type === ov.block_type ? replacement : b)) };
      if (ov.block_type) modifiedBlockTypes.add(ov.block_type);
      continue;
    }

    if (ov.action === "patch_block") {
      entry = {
        ...entry,
        blocks: entry.blocks.map((b) =>
          b.block_type === ov.block_type ? { ...b, data: jsonMergePatch(b.data, ov.patch) } : b
        ),
      };
      if (ov.block_type) modifiedBlockTypes.add(ov.block_type);
    }
  }

  if (!entry) return null;
  return { ...entry, disabled, modifiedBlockTypes: [...modifiedBlockTypes] };
}
