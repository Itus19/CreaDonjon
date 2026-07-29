/**
 * Un niveau 'campaign' ou 'user' sans visibility_scope_id est une donnee
 * incoherente : on refuse de deviner (SCHEMA.md §4, critere d'acceptation
 * du ticket P0-03), on leve une erreur explicite.
 */
export class VisibilityScopeError extends Error {
  constructor(public readonly level: string) {
    super(`Le niveau de visibilite '${level}' exige un visibility_scope_id, aucun n'a ete fourni`);
    this.name = "VisibilityScopeError";
  }
}
