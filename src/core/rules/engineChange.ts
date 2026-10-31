import { z } from "zod";

/**
 * V3.1-104 (ADR 0041, option B) — Le changement que le moteur produit au nom
 * d'un joueur et que le serveur signe. Un objet FERMÉ : la fonction de la base
 * refuse toute clé hors de cette liste, ce schéma aussi, avant même de signer.
 */
const zChange = z
  .object({
    kind: z.enum(["participant", "runtime"]),
    id: z.string().uuid(),
    hp: z.number().int().min(0).optional(),
    temp_hp: z.number().int().min(0).optional(),
    conditions: z.array(z.string().min(1)).max(40).optional(),
  })
  .strict();

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
