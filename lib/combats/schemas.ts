import { z } from "zod";

/** "Lancer le combat" (V1-E4) depuis la composition de Rencontres (V1-E3) — les PJ ne sont pas inclus ici, ajoutes ensuite depuis l'ecran d'initiative. */
export const createCombatSchema = z.object({
  name: z.string().trim().max(200).nullable().default(null),
  monsters: z.array(
    z.object({
      entryKey: z.string().trim().min(1),
      label: z.string().trim().min(1),
      count: z.number().int().positive().max(50),
    })
  ),
});

/** Renommage et/ou changement de statut manuel (V1-E4) — au moins un des deux, jamais un corps vide. */
export const patchCombatSchema = z
  .object({
    name: z.string().trim().max(200).nullable().optional(),
    status: z.enum(["draft", "rolling", "running", "ended"]).optional(),
  })
  .refine((data) => data.name !== undefined || data.status !== undefined, { message: "Rien à modifier." });

export const turnSchema = z.object({
  direction: z.enum(["next", "previous"]),
});

export const rollInitiativeSchema = z.object({
  participantId: z.string().trim().min(1).nullable().default(null),
});

/** Ajout d'un participant en cours de combat — trois provenances (specs/outils-mj.md §5.1), une seule renseignee a la fois. */
export const addParticipantSchema = z.discriminatedUnion("sourceKind", [
  z.object({ sourceKind: z.literal("entity"), entityId: z.string().trim().min(1), isAlly: z.boolean().default(true) }),
  z.object({
    sourceKind: z.literal("statblock"),
    entryKey: z.string().trim().min(1),
    label: z.string().trim().min(1),
    isAlly: z.boolean().default(false),
  }),
  z.object({ sourceKind: z.literal("custom"), label: z.string().trim().min(1), isAlly: z.boolean().default(false) }),
]);

export const patchParticipantSchema = z.object({
  initiative: z.number().int().optional(),
  ac: z.number().int().positive().optional(),
  hpCurrent: z.number().int().nonnegative().optional(),
  tempHp: z.number().int().nonnegative().optional(),
  conditions: z.array(z.string()).optional(),
  concentration: z.object({ label: z.string().trim().min(1) }).nullable().optional(),
  note: z.string().trim().min(1).max(200),
});

/**
 * V3.1-103 (ADR 0040) — une joueuse écrit l'initiative de son PJ pendant les
 * jets. « roll » : le serveur tire (règle 8). « die » : le dé de la table ;
 * `natural` est le d20 (1 à 20), ou le total déjà annoncé si
 * `modifierIncluded` (borné comme en base, −10 à 40).
 */
export const myInitiativeSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("roll") }),
  z
    .object({ mode: z.literal("die"), natural: z.number().int().min(-10).max(40), modifierIncluded: z.boolean() })
    .refine((v) => v.modifierIncluded || (v.natural >= 1 && v.natural <= 20), {
      message: "Un d20 naturel va de 1 à 20.",
      path: ["natural"],
    }),
]);
export type MyInitiativeInput = z.infer<typeof myInitiativeSchema>;

/**
 * V3.1-105 (ADR 0042) — un jet ciblé contre un participant du combat en cours.
 * L'acteur : un personnage (sa fiche) ou un participant (un monstre et son
 * bloc de stats). L'action : une arme de l'inventaire, un sort connu, ou une
 * action du bloc de stats. Les combinaisons sont vérifiées par le service.
 */
export const targetedRollSchema = z.object({
  kind: z.enum(["attack", "damage", "spell_attack", "spell_save", "heal"]),
  actor: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("character"), entityId: z.string().uuid() }),
    z.object({ kind: z.literal("participant"), participantId: z.string().uuid() }),
  ]),
  action: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("weapon"), itemId: z.string().min(1).max(200) }),
    z.object({ kind: z.literal("spell"), spellKey: z.string().min(1).max(200), slotLevel: z.number().int().min(0).max(9) }),
    z.object({ kind: z.literal("monster_action"), name: z.string().min(1).max(200) }),
  ]),
  targetId: z.string().uuid(),
  advantage: z.enum(["normal", "advantage", "disadvantage"]).default("normal"),
  /** Dégâts seulement : la demande chaînée d'une attaque critique double les dés. */
  critical: z.boolean().default(false),
  /** Les jets d'un monstre (MJ) restent cachés ; les jets d'une fiche restent publics (ADR 0038 pas encore fait). */
  secret: z.boolean().default(false),
});
export type TargetedRollInput = z.infer<typeof targetedRollSchema>;
