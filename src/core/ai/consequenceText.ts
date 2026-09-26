/**
 * V3-C5 — Le tiroir de conséquences : traduire une ligne `ai_proposals` en
 * une phrase lisible, et compter ce que la séance a réellement fait grandir.
 * Module PUR — aucune donnée de base, seulement ce que l'appelant lui donne
 * déjà résolu (`src/server/services/consequencesDrawer.ts`).
 */

export type ConsequenceKind =
  | "create_entity"
  | "update_entity"
  | "create_block"
  | "update_block"
  | "create_relation"
  | "set_discovery"
  | "update_mechanical";

/** Toujours une phrase, jamais une clé technique affichée telle quelle — les `kind` pas encore produits par ce lot restent lisibles au pire par leur nom. */
export function describeConsequence(kind: ConsequenceKind, payload: unknown): string {
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  switch (kind) {
    case "create_entity": {
      const name = typeof p.name === "string" ? p.name : "une entité";
      const trait = typeof p.trait === "string" ? p.trait : null;
      return trait ? `${name} — ${trait}` : name;
    }
    case "update_block":
      return typeof p.text === "string" ? p.text : "un ajout au texte";
    default:
      return kind;
  }
}

export interface ConsequenceTally {
  entities: number;
  blocks: number;
  relations: number;
}

/**
 * « Le monde a gagné 3 fiches, 7 blocs et 2 relations » (docs/BACKLOG_V3.md) :
 * ce que gagne le monde, pas ce qu'il modifie — `update_block` (un
 * paragraphe ajouté à un bloc EXISTANT) ne compte donc pas ici, même s'il
 * apparaît dans la liste des changements.
 */
export function tallyConsequences(kinds: ConsequenceKind[]): ConsequenceTally {
  const tally: ConsequenceTally = { entities: 0, blocks: 0, relations: 0 };
  for (const kind of kinds) {
    if (kind === "create_entity") tally.entities += 1;
    else if (kind === "create_block") tally.blocks += 1;
    else if (kind === "create_relation") tally.relations += 1;
  }
  return tally;
}
