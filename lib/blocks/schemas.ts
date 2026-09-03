import { z } from "zod";
import { BLOCK_TYPES } from "@/src/core/schemas/blocks/registry";
import { zBlockDisplay } from "@/src/core/schemas/blocks/envelope";
import { zVisibilityInput } from "@/lib/visibility/schemas";
import { zGameDate } from "@/src/core/schemas/calendar";
import { PERSONALITY_POLE_KEYS, RELATIONSHIP_AXIS_KEYS, WORLDVIEW_POLE_KEYS } from "@/src/core/psyche/keys";
import { DEFAULT_PROSE_LENGTH } from "@/src/core/generators/types";

export const createBlockSchema = z.object({
  entityId: z.guid(),
  blockType: z.enum(BLOCK_TYPES),
  label: z.string().trim().min(1, "Le titre est requis.").max(100, "100 caracteres maximum."),
  visibility: zVisibilityInput,
});

export const updateBlockSchema = z.object({
  version: z.number().int().positive(),
  display: zBlockDisplay,
  data: z.unknown(),
  visibility: zVisibilityInput,
});

export const reorderBlockSchema = z.object({
  version: z.number().int().positive(),
  displayOrder: z.number(),
});

/** Tirage sur un bloc random_table (V1-E1) — un seul champ optionnel, jamais plus que le nombre d'entrees distinctes d'une table (verifie cote pur, src/core/tables/roll.ts). */
export const drawTableSchema = z.object({
  count: z.number().int().min(1).max(20).default(1),
});

/**
 * Tirage sur un bloc generator (V1-E2/V2-J1) — `proseLength` choisi par
 * l'auteur au moment de generer (retour utilisateur explicite), jamais
 * figee dans le bloc. Les trois valeurs sont ecrites en dur (miroir de
 * `PROSE_LENGTH_PRESETS`) : `z.union` exige un tuple litteral, pas un
 * tableau construit dynamiquement.
 *
 * `onlySlotKey`/`knownSlotTexts` (V2-J1 Phase 2, outil MJ decompose) :
 * relance d'un seul emplacement plutot que tout le bloc — le serveur reste
 * sans etat, c'est le client qui renvoie les valeurs deja tirees des
 * AUTRES emplacements pour que la route les reutilise dans le gabarit
 * recompose (et dans le prompt IA si le bloc contient un emplacement
 * `prose`, cf. app/api/blocks/[blockId]/generate/route.ts).
 */
export const drawGeneratorSchema = z.object({
  proseLength: z.union([z.literal(30), z.literal(100), z.literal(250)]).default(DEFAULT_PROSE_LENGTH),
  onlySlotKey: z.string().min(1).max(100).nullable().default(null),
  knownSlotTexts: z.record(z.string(), z.string()).default({}),
});

/** Assistance redactionnelle (V1-F3) — instruction libre envoyee au modele, jamais un identifiant : le bloc cible vient de la route, pas du corps. */
export const writingAssistSchema = z.object({
  instruction: z.string().trim().min(1).max(500),
});

/** Bascule d'un objectif de quete (V2-H4) — jamais la donnee entiere du bloc : un seul objectif, par id, pour rester journalisable sans ambiguite sur ce qui a change. */
export const toggleQuestObjectiveSchema = z.object({
  version: z.number().int().positive(),
  objectiveId: z.string().min(1),
  done: z.boolean(),
});

/** Promotion d'une entree de timeline en entite (V2-H2) — jamais l'inverse, jamais deux fois la meme entree (verifie cote service : `entry.ref` deja pose). */
export const promoteTimelineEntrySchema = z.object({
  version: z.number().int().positive(),
  entryId: z.string().min(1),
});

/** Souvenir ajoute a un bloc personality (V2-H1) — au moins un pole touche, sinon rien a journaliser. */
export const addPersonalityEventSchema = z.object({
  version: z.number().int().positive(),
  summary: z.string().trim().min(1).max(500),
  // `z.record(z.enum(...), ...)` exigerait TOUTES les cles de l'enum (Zod v4,
  // les enums sont des cles "fermees") — un souvenir n'en touche presque
  // jamais six a la fois, donc cle libre + verification manuelle.
  deltas: z
    .record(z.string(), z.number().int().min(-100).max(100))
    .refine((d) => Object.keys(d).length > 0, { message: "Au moins un pole doit etre touche." })
    .refine((d) => Object.keys(d).every((k) => (PERSONALITY_POLE_KEYS as readonly string[]).includes(k)), {
      message: "Pole inconnu.",
    }),
  occurredAtIngame: zGameDate.nullable().default(null),
});

/** Souvenir ajoute a une relation (V2-H1, bloc `relationship`) — meme forme que `addPersonalityEventSchema`, cle libre pour la meme raison, plus la cible (la paire n'est jamais dans l'URL seule, `POST` groupe la creation). */
export const addAttitudeEventSchema = z.object({
  targetEntityId: z.string().min(1),
  summary: z.string().trim().min(1).max(500),
  deltas: z
    .record(z.string(), z.number().int().min(-100).max(100))
    .refine((d) => Object.keys(d).length > 0, { message: "Au moins un axe doit etre touche." })
    .refine((d) => Object.keys(d).every((k) => (RELATIONSHIP_AXIS_KEYS as readonly string[]).includes(k)), {
      message: "Axe inconnu.",
    }),
  occurredAtIngame: zGameDate.nullable().default(null),
});

/** Souvenir ajoute a un bloc worldview (V2-H1) — meme forme que `addPersonalityEventSchema`, poles moraux/politiques au lieu du temperament. */
export const addWorldviewEventSchema = z.object({
  version: z.number().int().positive(),
  summary: z.string().trim().min(1).max(500),
  deltas: z
    .record(z.string(), z.number().int().min(-100).max(100))
    .refine((d) => Object.keys(d).length > 0, { message: "Au moins un pole doit etre touche." })
    .refine((d) => Object.keys(d).every((k) => (WORLDVIEW_POLE_KEYS as readonly string[]).includes(k)), {
      message: "Pole inconnu.",
    }),
  occurredAtIngame: zGameDate.nullable().default(null),
});

/** Bascule "afficher au wiki" d'une ligne de souvenir (V2, retour utilisateur point 5) — meme schema pour `personality_events` (partage personality/worldview) et `attitude_events`. */
export const setEventVisibilitySchema = z.object({
  isPublic: z.boolean(),
});
