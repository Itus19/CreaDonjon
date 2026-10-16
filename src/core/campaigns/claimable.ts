/**
 * V3.1-100 (ADR 0049) — ce que l'écran de choix du personnage montre.
 *
 * La base dit quels PJ l'appelant peut réclamer (`list_claimable_characters`)
 * et lesquels lui sont réservés par un lien nominatif. Ici, seulement la
 * règle d'affichage : arrivée par un lien nominatif → ce PJ seul, et l'écran
 * s'ouvre sur lui ; sinon tous les PJ ouverts, et l'écran s'ouvre sur
 * « Nouveau personnage ». La carte « Nouveau personnage » est toujours là ;
 * elle n'est pas dans la liste.
 */
export interface ClaimableRow {
  entityId: string;
  reservedForMe: boolean;
}

export type ChooseStart = { kind: "new" } | { kind: "character"; entityId: string };

export interface ClaimableView {
  entityIds: string[];
  startOn: ChooseStart;
}

/** `visibleIds` : les fiches que la joueuse peut lire (RLS). Une fiche cachée n'apparaît jamais, réservée ou non. */
export function claimableView(rows: readonly ClaimableRow[], visibleIds: ReadonlySet<string>): ClaimableView {
  const visibles = rows.filter((row) => visibleIds.has(row.entityId));
  const reserved = visibles.filter((row) => row.reservedForMe);
  if (reserved.length > 0) {
    return { entityIds: reserved.map((row) => row.entityId), startOn: { kind: "character", entityId: reserved[0].entityId } };
  }
  return { entityIds: visibles.map((row) => row.entityId), startOn: { kind: "new" } };
}
