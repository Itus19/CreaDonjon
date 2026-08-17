export class TableError extends Error {}

export class InvalidDieError extends TableError {
  constructor(die: string) {
    super(`Notation de dé invalide : "${die}"`);
  }
}

export class NoMatchingEntryError extends TableError {
  constructor(roll: number) {
    super(`Aucune entrée de table ne couvre le résultat ${roll}`);
  }
}

/** Profondeur maximale d'un tirage en cascade (specs/outils-mj.md §2.1 : "Profondeur bornée à 3, cycles détectés"). */
export const MAX_TABLE_CASCADE_DEPTH = 3;

export class TableCascadeDepthError extends TableError {
  constructor() {
    super(`Tirage en cascade trop profond (max ${MAX_TABLE_CASCADE_DEPTH})`);
  }
}

export class TableCascadeCycleError extends TableError {
  constructor(tableKey: string) {
    super(`Cycle détecté dans un tirage en cascade (retour sur "${tableKey}")`);
  }
}
