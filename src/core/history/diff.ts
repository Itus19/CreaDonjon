import type { BlockDiffEntry, EntityFieldChange, EntitySnapshot, EntitySnapshotDiff } from "./types";

function aliasesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, i) => value === sortedB[i]);
}

function diffEntityFields(before: EntitySnapshot["entity"], after: EntitySnapshot["entity"]): EntityFieldChange[] {
  const changes: EntityFieldChange[] = [];
  if (before.name !== after.name) {
    changes.push({ field: "name", before: before.name, after: after.name });
  }
  if (before.entityKind !== after.entityKind) {
    changes.push({ field: "entityKind", before: before.entityKind, after: after.entityKind });
  }
  if (!aliasesEqual(before.aliases, after.aliases)) {
    changes.push({ field: "aliases", before: before.aliases, after: after.aliases });
  }
  return changes;
}

/** Contenu redactionnel d'un bloc : tout sauf `displayOrder` (presentation pure, cf. diff.test.ts). */
function blockContentKey(b: EntitySnapshot["blocks"][number]): string {
  return JSON.stringify({
    blockType: b.blockType,
    display: b.display,
    data: b.data,
    visibilityLevel: b.visibilityLevel,
    visibilityScopeId: b.visibilityScopeId,
  });
}

function blockLabel(b: EntitySnapshot["blocks"][number]): string {
  const display = b.display as { label?: unknown } | null;
  return typeof display?.label === "string" ? display.label : "";
}

function diffBlocks(before: EntitySnapshot["blocks"], after: EntitySnapshot["blocks"]): BlockDiffEntry[] {
  const beforeById = new Map(before.map((b) => [b.id, b]));
  const afterById = new Map(after.map((b) => [b.id, b]));
  const entries: BlockDiffEntry[] = [];

  for (const b of before) {
    if (!afterById.has(b.id)) {
      entries.push({ id: b.id, status: "removed", blockType: b.blockType, label: blockLabel(b) });
    }
  }
  for (const b of after) {
    const prior = beforeById.get(b.id);
    if (!prior) {
      entries.push({ id: b.id, status: "added", blockType: b.blockType, label: blockLabel(b) });
    } else if (blockContentKey(prior) !== blockContentKey(b)) {
      entries.push({ id: b.id, status: "changed", blockType: b.blockType, label: blockLabel(b) });
    }
  }
  return entries;
}

/**
 * Diff pur entre deux instantanes de fiche (V1-C3). Ignore volontairement
 * `displayOrder` : un reordonnancement pur n'est pas une edition
 * redactionnelle (specs/wiki-blocs.md §4.5), il ne cree meme pas de
 * nouvelle revision (voir src/server/services/entities.ts).
 */
export function diffEntitySnapshots(before: EntitySnapshot, after: EntitySnapshot): EntitySnapshotDiff {
  return {
    entityChanges: diffEntityFields(before.entity, after.entity),
    blocks: diffBlocks(before.blocks, after.blocks),
  };
}
