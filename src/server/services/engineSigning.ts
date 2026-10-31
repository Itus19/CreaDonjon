import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { canonicalJson, zEngineChange, type EngineChange } from "@/src/core/rules/engineChange";
import { applyEngineChange } from "@/src/server/repos/engineChanges";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-104 (ADR 0041, option B) — Le serveur signe les changements que le
 * moteur produit au nom d'un joueur ; la base ne les applique qu'avec une
 * signature valide. La clé : `ENGINE_SIGNING_KEY` (64 caractères hexadécimaux,
 * 32 octets) et `ENGINE_SIGNING_KEY_ID`, serveur uniquement (jamais
 * `NEXT_PUBLIC_`), la même que la ligne de `app_private.engine_signing_keys`
 * (docs/CLE-MOTEUR.md).
 */
export interface EngineSigningKey {
  id: string;
  secret: Buffer;
}

/** La clé de l'environnement. Absente ou mal formée : une erreur explicite, jamais un repli silencieux. */
export function engineSigningKeyFromEnv(env: NodeJS.ProcessEnv = process.env): EngineSigningKey {
  const id = env.ENGINE_SIGNING_KEY_ID;
  const hex = env.ENGINE_SIGNING_KEY;
  if (!id || !hex) throw new Error("ENGINE_SIGNING_KEY et ENGINE_SIGNING_KEY_ID doivent être posées (docs/CLE-MOTEUR.md).");
  if (!/^[0-9a-fA-F]{64,}$/.test(hex) || hex.length % 2 !== 0) throw new Error("ENGINE_SIGNING_KEY doit être hexadécimale, 32 octets au moins.");
  return { id, secret: Buffer.from(hex, "hex") };
}

export type EngineChangeLine = EngineChange["changes"][number];

/** Construit, valide et signe un changement : le texte canonique exact, et son HMAC-SHA256 en hexadécimal. */
export function signEngineChange(
  params: { campaignId: string; changes: EngineChangeLine[]; now?: Date; nonce?: string },
  key: EngineSigningKey
): { payload: string; signature: string } {
  const change = zEngineChange.parse({
    key_id: key.id,
    nonce: params.nonce ?? randomUUID(),
    issued_at: (params.now ?? new Date()).toISOString(),
    campaign_id: params.campaignId,
    changes: params.changes,
  });
  const payload = canonicalJson(change);
  return { payload, signature: createHmac("sha256", key.secret).update(payload, "utf8").digest("hex") };
}

/** Signe avec la clé de l'environnement et applique, avec le client de l'utilisateur. */
export async function applySignedEngineChange(supabase: TypedClient, params: { campaignId: string; changes: EngineChangeLine[] }): Promise<void> {
  const { payload, signature } = signEngineChange(params, engineSigningKeyFromEnv());
  await applyEngineChange(supabase, payload, signature);
}
