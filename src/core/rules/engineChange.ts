import { z } from "zod";

/**
 * V3.1-104 (ADR 0041, option B) — Le changement que le moteur produit au nom
 * d'un joueur et que le serveur signe. Un objet FERMÉ : la fonction de la base
 * refuse toute clé hors de cette liste, ce schéma aussi, avant même de signer.
 */
const zStateChange = z
  .object({
    kind: z.enum(["participant", "runtime"]),
    id: z.string().uuid(),
    hp: z.number().int().min(0).optional(),
    temp_hp: z.number().int().min(0).optional(),
    conditions: z.array(z.string().min(1)).max(40).optional(),
  })
  .strict();

/**
 * V3.1-130 (ADR 0073) — poser un effet qui dure sur une instance de combat ou
 * un PJ de la campagne. `effect` est exactement ce que la base accepte : la
 * fonction refuse toute autre clé.
 */
const zEffectAdd = z
  .object({
    kind: z.literal("effect_add"),
    id: z.string().uuid(),
    bearer: z.enum(["participant", "entity"]),
    effect: z
      .object({
        label: z.string().min(1).max(200),
        source_key: z.string().min(1).max(200),
        modifiers: z.array(z.unknown()).max(20),
        duration: z.record(z.string(), z.unknown()),
        payload: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

/** V3.1-130 : retirer un effet (ligne de `entity_active_effects`) de la campagne. */
const zEffectRemove = z.object({ kind: z.literal("effect_remove"), id: z.string().uuid() }).strict();

/** V3.1-160 (ADR 0075) : le compte de tour d'un participant (réaction datée, usages « une fois par tour »). */
const zTurnUsageChange = z
  .object({
    kind: z.literal("turn_usage"),
    id: z.string().uuid(),
    turn_usage: z
      .object({
        reaction_at: z.string().max(40).nullable(),
        once: z.record(z.string().max(300), z.string().max(40)),
        // V3.1-165 (ADR 0076) : le budget du tour ; la base l'accepte depuis la migration du 165.
        budget: z.object({ at: z.string().max(40), action: z.number().int(), bonus: z.number().int(), attacks: z.number().int(), extraNotMagic: z.number().int() }).strict().optional(),
      })
      .strict(),
  })
  .strict();

/**
 * V3.1-200 (ADR 0091) — une demande de sauvegarde au nom d'une joueuse (son
 * sort à sauvegarde). `id` : la NOUVELLE demande, tirée par le serveur.
 * Fermée : ni le compte qui répond ni la fiche de la cible, que la base
 * déduit elle-même de la ligne de combat visée.
 */
const zSaveRequestChange = z
  .object({
    kind: z.literal("save_request"),
    id: z.string().uuid(),
    request: z
      .object({
        combat_id: z.string().uuid(),
        target_id: z.string().uuid(),
        label: z.string().min(1).max(300),
        ability: z.enum(["str", "dex", "con", "int", "wis", "cha"]),
        dc: z.number().int().min(1).max(40),
        effect: z.record(z.string(), z.unknown()),
        origin_roll_id: z.string().uuid().nullable(),
      })
      .strict(),
  })
  .strict();

const zChange = z.union([zStateChange, zEffectAdd, zEffectRemove, zTurnUsageChange, zSaveRequestChange]);

export const zEngineChange = z
  .object({
    key_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    nonce: z.string().uuid(),
    issued_at: z.string().datetime(),
    campaign_id: z.string().uuid(),
    changes: z.array(zChange).min(1).max(50),
  })
  .strict();

export type EngineChange = z.infer<typeof zEngineChange>;

/** V3.1-107 (ADR 0069) — une demande de LECTURE des participants d'un combat, signée comme un changement. Fermée, et sans `changes` : l'une ne passe jamais pour l'autre. */
export const zEngineReadRequest = z
  .object({
    key_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    nonce: z.string().uuid(),
    issued_at: z.string().datetime(),
    campaign_id: z.string().uuid(),
    combat_id: z.string().uuid(),
  })
  .strict();

export type EngineReadRequest = z.infer<typeof zEngineReadRequest>;

/**
 * La forme canonique d'une valeur JSON : clés d'objet triées à tous les
 * niveaux, aucun espace. Le serveur signe CE texte, et l'envoie tel quel à la
 * base, qui calcule l'HMAC sur les mêmes octets : la signature ne dépend
 * d'aucun ordre d'insertion des clés.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * V3.1-160 (ADR 0075) — ouvrir une fenêtre de réaction : la partie lisible et
 * l'état figé, signés ensemble. La base les range sans rien recalculer ; une
 * joueuse ne peut ni fabriquer ni retoucher un jet suspendu.
 */
export const zEngineWindowOpen = z
  .object({
    key_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    nonce: z.string().uuid(),
    issued_at: z.string().datetime(),
    campaign_id: z.string().uuid(),
    window: z
      .object({
        combat_id: z.string().uuid().nullable(),
        kind: z.enum(["attack", "save", "check", "damage"]),
        label: z.string().min(1).max(300),
        view: z.record(z.string(), z.unknown()),
        choices: z.array(z.object({ user_id: z.string().uuid().nullable() }).passthrough()).min(1).max(20),
        state: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

/** V3.1-160 : reprendre une fenêtre fermée (lire son état figé, une fois). */
export const zEngineWindowResume = z
  .object({
    key_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    nonce: z.string().uuid(),
    issued_at: z.string().datetime(),
    campaign_id: z.string().uuid(),
    window_id: z.string().uuid(),
  })
  .strict();
