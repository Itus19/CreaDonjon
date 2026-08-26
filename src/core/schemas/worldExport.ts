import { z } from "zod";
import { BLOCK_TYPES } from "./blocks/registry";
import { RELATION_TYPES } from "../relations/inverses";

/**
 * Format d'export/import d'un monde (V2-G1, dernier point du ticket).
 * Enveloppe volontairement permissive sur `data`/`display`/`calendar`
 * (`z.unknown()`) : ce sont des jsonb sans forme unique imposee en base
 * (ex. `display: {}` est une valeur reelle et valide, que `zBlockDisplay`
 * rejetterait a tort avec son `label` obligatoire). La validation fine du
 * contenu d'un bloc se fait a part, par type, via `validateBlockData`
 * (registry.ts) — au moment de l'import, pas dans ce schema d'enveloppe.
 *
 * `*Ref` (jamais `*Id`) : ce sont des cles LOCALES a un fichier d'export
 * (les ids originaux, reutilises tels quels comme reference stable a
 * l'interieur du JSON) — jamais des ids qui existeront tels quels apres
 * import, qui en genere de nouveaux pour eviter toute collision avec une
 * base existante.
 */
export const WORLD_EXPORT_FORMAT_VERSION = 1;

const zVisibilityLevel = z.enum(["public", "players", "gm", "campaign", "user", "private"]);

// `slug` n'est jamais exporte : c'est un numero sequentiel PAR MONDE
// (V0-06g, src/core/slug/slug.ts), sans rapport avec le nom — le reutiliser
// tel quel dans un autre monde entrerait en collision avec sa propre
// sequence (la premiere entite du monde importe, deja creee par
// `createCampaign` avant la boucle d'import, occupe deja le numero 1). Une
// entite importee recoit un numero frais, exactement comme une entite creee
// a la main.
const zExportedEntity = z.object({
  ref: z.string().min(1),
  entityKind: z.string().min(1),
  // Pas de min(1) : `entities.name` est "not null" en base, jamais garanti
  // non-vide par une contrainte — une fiche existante peut porter un nom
  // vide, l'export doit pouvoir la reproduire telle quelle.
  name: z.string(),
  aliases: z.array(z.string()),
  currentRevisionNumber: z.number().int().positive().nullable(),
});

// `blocks.version` (concurrence optimiste, SCHEMA.md §1.7) n'est jamais
// exporte : une ligne fraichement importee n'a encore ete editee par
// personne, elle repart a 1 (valeur par defaut de la colonne).
const zExportedBlock = z.object({
  entityRef: z.string().min(1),
  blockType: z.enum(BLOCK_TYPES),
  display: z.unknown(),
  data: z.unknown(),
  displayOrder: z.number(),
  // 'campaign'/'user' n'apparaissent jamais ici : ramenes a 'gm' des
  // l'export (voir exportWorld) puisque leur scopeId (id de campagne ou
  // d'utilisateur) ne survit a aucun transfert vers un autre compte/monde.
  visibilityLevel: zVisibilityLevel.exclude(["campaign", "user"]),
});

const zExportedRelation = z.object({
  sourceRef: z.string().min(1),
  targetRef: z.string().min(1),
  relationType: z.enum(RELATION_TYPES),
  visibilityLevel: zVisibilityLevel.exclude(["campaign", "user"]),
});

const zExportedMechanicalRevision = z.object({
  entityRef: z.string().min(1),
  revisionNumber: z.number().int().positive(),
  mechanicalData: z.unknown(),
  changeNote: z.string().nullable(),
});

const zBaseSystem = z.enum(["dnd_srd_51", "dnd_srd_52", "custom"]);

const zExportedRulesetOverride = z.object({
  entryKey: z.string().min(1),
  blockType: z.string().nullable(),
  action: z.enum(["add_entry", "disable_entry", "replace_entry", "add_block", "patch_block", "replace_block", "remove_block"]),
  payload: z.unknown(),
  patch: z.unknown(),
  note: z.string().nullable(),
});

/**
 * `personal_omitted` : le monde utilisait un ruleset `personal_reference`
 * (specs/ruleset-personnel.md §3.2) — son contenu (surcharges) n'est jamais
 * inclus, seule la reference au systeme de base survit. Reimporter demande
 * de ressaisir la variante a la main, c'est le comportement voulu.
 */
const zExportedRuleset = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("official"), baseSystem: zBaseSystem }),
  z.object({
    kind: z.literal("variant"),
    name: z.string().min(1),
    baseSystem: zBaseSystem,
    overrides: z.array(zExportedRulesetOverride),
  }),
  z.object({
    kind: z.literal("personal_omitted"),
    name: z.string().min(1),
    baseSystem: zBaseSystem,
    note: z.string(),
  }),
]);

export const zWorldExport = z.object({
  formatVersion: z.literal(WORLD_EXPORT_FORMAT_VERSION),
  world: z.object({
    name: z.string().min(1),
    calendar: z.unknown(),
  }),
  ruleset: zExportedRuleset,
  /** Mode de la campagne unique du monde source, si elle en a une — simple suggestion pre-remplie a l'import, jamais impose. */
  suggestedMode: z.enum(["campaign", "solo"]).nullable(),
  entities: z.array(zExportedEntity),
  blocks: z.array(zExportedBlock),
  relations: z.array(zExportedRelation),
  mechanicalRevisions: z.array(zExportedMechanicalRevision),
});
export type WorldExport = z.infer<typeof zWorldExport>;
export type ExportedRuleset = z.infer<typeof zExportedRuleset>;
