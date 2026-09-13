import type { Segment } from "../schemas/entities/segments";

export interface ExtractedMention {
  targetKind: "entity" | "rule";
  targetEntityId?: string;
  targetRuleKey?: string;
  /** Héritée du segment d'ORIGINE (specs/wiki-liens-et-personnages.md §A2, "le piège à ne pas rater") — jamais une visibilité par défaut, une mention doit disparaître exactement comme le passage qui la porte. */
  visibilityLevel: string;
  visibilityScopeId: string | null;
}

/**
 * Extrait les mentions (rétroliens, V2.1-1/§A2) portées par les noeuds `ref`
 * d'une liste de segments — recalculée à CHAQUE écriture d'un bloc de texte,
 * jamais accumulée (l'appelant remplace toutes les lignes de cette source,
 * §A2 "Recalculé à chaque écriture d'entité"). Fonction pure : la
 * persistance (remplacement en base) vit dans
 * `src/server/repos/entityMentions.ts`.
 */
export function extractMentionsFromSegments(segments: readonly Segment[]): ExtractedMention[] {
  const mentions: ExtractedMention[] = [];
  for (const segment of segments) {
    for (const node of segment.content) {
      if (node.t !== "ref") continue;
      if (node.kind === "entity" && node.id) {
        mentions.push({
          targetKind: "entity",
          targetEntityId: node.id,
          visibilityLevel: segment.visibility.level,
          visibilityScopeId: segment.visibility.scopeId,
        });
      } else if (node.kind === "rule" && node.key) {
        mentions.push({
          targetKind: "rule",
          targetRuleKey: node.key,
          visibilityLevel: segment.visibility.level,
          visibilityScopeId: segment.visibility.scopeId,
        });
      }
    }
  }
  return mentions;
}
