import { z } from "zod";

/**
 * Parametres d'URL des routes GET (audit B-06). Dix routes de `app/api/**`
 * lisaient `searchParams.get(...)` a la main : un `worldId` mal forme
 * descendait jusqu'a Postgres et remontait en 500, un `limit` illisible
 * retombait sur un defaut sans que l'appelant l'apprenne jamais. La regle
 * absolue n° 4 de CLAUDE.md ne distingue pas le corps de la requete de son
 * URL : "toute entree de route serveur est validee par un schema Zod".
 *
 * Meme discipline que `lib/uploads/schemas.ts` (B-05) : ces schemas
 * reproduisent le comportement existant, replis compris. Un identifiant
 * mal forme devient un 400 explicite — c'etait le but du constat — mais un
 * `limit` hors bornes continue d'etre ramene dans les bornes, et une
 * profondeur illisible continue de retomber sur sa valeur par defaut.
 * Durcir ces trois-la se decide separement.
 */

/**
 * Lit les parametres d'une URL comme un objet simple.
 *
 * Une cle absente n'est pas dans l'objet, donc vaut `undefined` a la
 * lecture — c'est exactement ce que faisait le `?? valeur` du code
 * remplace, et ce dont `.default()`/`.catch()` ont besoin (`Number(null)`
 * vaut `0`, pas `NaN` : passer le `null` brut de `get()` a une coercition
 * numerique aurait silencieusement transforme "absent" en zero).
 *
 * Sur une cle repetee, la derniere valeur gagne, la ou `get()` renvoyait la
 * premiere. Aucune de ces routes n'attend de parametre repete.
 */
export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  return Object.fromEntries(searchParams.entries());
}

/** Identifiant optionnel. `?campaignId=` (valeur vide) vaut absent — le client l'envoie ainsi. */
const zOptionalGuid = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v))
  .pipe(z.guid("Identifiant invalide.").optional());

/** Taille de page : bornee, jamais refusee. Illisible ou absente → `fallback` ; hors bornes → ramenee dedans. */
function zClampedLimit(fallback: number, max: number) {
  return z.coerce
    .number()
    .catch(fallback)
    .transform((n) => (Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), max) : fallback));
}

/** Nombre libre avec repli. Ni borne ni arrondi : les profondeurs de graphe n'en avaient pas, en ajouter serait un durcissement. */
function zNumberOr(fallback: number) {
  return z.coerce.number().catch(fallback);
}

const HISTORY_LIMIT_DEFAULT = 50;
const HISTORY_LIMIT_MAX = 200;

/** `GET /api/admin/journal` — le seul `worldId` en parametre d'URL du projet. */
export const journalQuerySchema = z.object({
  worldId: z.guid("worldId requis."),
});

/**
 * `GET /api/campaigns/[campaignId]/chat/messages` et
 * `POST .../chat/read` — `avec` designe le fil d'un joueur. Le schema n'en
 * verifie que la forme : c'est `resolveThreadUserId` qui decide qui a le
 * droit de lire quel fil, et il reste seul juge (services/chat.ts).
 */
export const chatMessagesQuerySchema = z.object({
  limit: zClampedLimit(HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX),
  avec: zOptionalGuid,
});

export const chatReadQuerySchema = z.object({
  avec: zOptionalGuid,
});

/** `GET /api/campaigns/[campaignId]/dice-rolls` — historique du volet de des. */
export const diceRollsQuerySchema = z.object({
  limit: zClampedLimit(HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_MAX),
});

/** `GET /api/entities/[id]/export` et `GET /api/entities/[id]/sheet` — etat de jeu, par campagne ou hors partie. */
export const entityCampaignQuerySchema = z.object({
  campaignId: zOptionalGuid,
});

/** `GET /api/entities/[id]/genealogy` — `rootEntityId` absent signifie "l'entite elle-meme", resolu par la route. */
export const genealogyQuerySchema = z.object({
  rootEntityId: zOptionalGuid,
  depthUp: zNumberOr(2),
  depthDown: zNumberOr(2),
});

/** `GET /api/entities/[id]/relations-graph` — meme patron que la genealogie. */
export const relationsGraphQuerySchema = z.object({
  rootEntityId: zOptionalGuid,
  maxDegree: zNumberOr(1),
});

/**
 * `GET /api/entities/[id]/revisions/compare` — les deux numeros sont
 * obligatoires. Ils l'etaient deja dans l'intention (la route renvoyait
 * deja un 400), mais pas en fait : `Number(null)` vaut `0`, un entier, donc
 * un parametre absent passait le controle et partait comparer la revision
 * numero zero. Ici, absent est refuse.
 */
export const revisionsCompareQuerySchema = z.object({
  from: z.coerce.number("Parametres from/to invalides.").int("Parametres from/to invalides."),
  to: z.coerce.number("Parametres from/to invalides.").int("Parametres from/to invalides."),
});

/**
 * `GET /api/worlds/[worldSlug]/entities-search` — recherche par slug de
 * monde. `q` vide est licite et renvoie une liste vide (`searchEntities`),
 * contrairement a `/api/search` qui l'exige non vide ; cette dissymetrie
 * est celle du code existant, pas une decision prise ici.
 */
export const entitiesSearchQuerySchema = z.object({
  q: z.string().default(""),
});
