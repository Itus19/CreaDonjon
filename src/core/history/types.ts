/**
 * Forme d'un instantane de fiche (SCHEMA.md §15 : "entite + blocs, en
 * entier"). Stockee telle quelle dans `entity_revisions.snapshot` (jsonb).
 * Les relations sont volontairement absentes (docs/BACKLOG_V1.md V1-C3,
 * decision de perimetre) : une relation est partagee entre deux fiches, sa
 * restauration depuis l'instantane d'une seule d'entre elles souleverait des
 * questions distinctes (supprimer une relation que l'autre fiche ne
 * s'attend pas a voir disparaitre).
 */
export interface EntitySnapshotBlock {
  id: string;
  blockType: string;
  display: unknown;
  data: unknown;
  displayOrder: number;
  visibilityLevel: string;
  visibilityScopeId: string | null;
  createdBy: string | null;
}

export interface EntitySnapshot {
  entity: {
    name: string;
    entityKind: string;
    aliases: string[];
  };
  blocks: EntitySnapshotBlock[];
}

export interface EntityFieldChange {
  field: "name" | "entityKind" | "aliases";
  before: string | string[];
  after: string | string[];
}

export type BlockDiffStatus = "added" | "removed" | "changed";

export interface BlockDiffEntry {
  id: string;
  status: BlockDiffStatus;
  blockType: string;
  label: string;
}

export interface EntitySnapshotDiff {
  entityChanges: EntityFieldChange[];
  blocks: BlockDiffEntry[];
}
