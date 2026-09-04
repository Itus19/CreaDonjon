import type { Segment } from "../schemas/entities/segments";

export interface RefTargetIds {
  /** Identifiants d'entite (dedupliques) references par un noeud `ref` de kind "entity". */
  entityIds: string[];
  /** Cles de regle (dedupliquees) references par un noeud `ref` de kind "rule". */
  ruleKeys: string[];
}

/**
 * Identifiants cibles portes par les noeuds `ref` d'une liste de segments
 * (V2.1-1) — un noeud `ref` ne porte que l'identifiant/la cle de sa cible,
 * jamais assez pour un lien lisible cote wiki public : ces identifiants
 * servent a resoudre nom/slug (entite) cote serveur, meme motif que
 * `questRefs`/`timelineRefs` (`src/server/services/publicShare.ts`). Les
 * refs `asset` ne sont pas encore geres par ce ticket.
 */
export function collectRefTargetIds(segments: readonly Segment[]): RefTargetIds {
  const entityIds = new Set<string>();
  const ruleKeys = new Set<string>();
  for (const segment of segments) {
    for (const node of segment.content) {
      if (node.t !== "ref") continue;
      if (node.kind === "entity" && node.id) entityIds.add(node.id);
      if (node.kind === "rule" && node.key) ruleKeys.add(node.key);
    }
  }
  return { entityIds: [...entityIds], ruleKeys: [...ruleKeys] };
}
