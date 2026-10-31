import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { canonicalJson, zEngineChange, zEngineReadRequest, type EngineChange } from "@/src/core/rules/engineChange";
import { applyEngineChange, readCombatSigned, type CombatParticipantRow } from "@/src/server/repos/engineChanges";

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
export async function applySignedEngineChange(supabase: TypedClient, params: { campaignId: string; changes: EngineChangeLine[]; nonce?: string }): Promise<void> {
  const { payload, signature } = signEngineChange(params, engineSigningKeyFromEnv());
  await applyEngineChange(supabase, payload, signature);
}

/** V3.1-107 (ADR 0069) — signe une demande de lecture des participants d'un combat. */
export function signEngineRead(params: { campaignId: string; combatId: string; now?: Date; nonce?: string }, key: EngineSigningKey): { payload: string; signature: string } {
  const request = zEngineReadRequest.parse({
    key_id: key.id,
    nonce: params.nonce ?? randomUUID(),
    issued_at: (params.now ?? new Date()).toISOString(),
    campaign_id: params.campaignId,
    combat_id: params.combatId,
  });
  const payload = canonicalJson(request);
  return { payload, signature: createHmac("sha256", key.secret).update(payload, "utf8").digest("hex") };
}

/** Lit les participants d'un combat au nom d'un joueur : la base ne les rend qu'à une demande signée. */
export async function readCombatParticipantsSigned(supabase: TypedClient, params: { campaignId: string; combatId: string }): Promise<CombatParticipantRow[]> {
  const { payload, signature } = signEngineRead(params, engineSigningKeyFromEnv());
  return readCombatSigned(supabase, payload, signature);
}

/**
 * V3.1-107 — Le jeton de dégâts. Chez le MJ, une demande de dégâts suit une
 * attaque qui a touché sur parole. Un joueur, lui, pourrait demander des dégâts
 * (critiques) sans avoir touché : l'attaque qui touche lui rend un jeton signé
 * (acteur, action, cible, critique), et la demande de dégâts doit le présenter.
 * Son `nonce` devient celui de l'écriture signée : la base refuse qu'il serve
 * deux fois. Valable dix minutes.
 */
const zJetonDegats = z
  .object({
    k: z.literal("damage"),
    actor: z.string().uuid(),
    action: z.string().min(1).max(500),
    target: z.string().uuid(),
    critical: z.boolean(),
    iat: z.string().datetime(),
    nonce: z.string().uuid(),
  })
  .strict();
export type JetonDegats = z.infer<typeof zJetonDegats>;

const DUREE_JETON_MS = 10 * 60 * 1000;

export function signDamageToken(
  params: { actorEntityId: string; action: unknown; targetId: string; critical: boolean; now?: Date },
  key: EngineSigningKey
): string {
  const jeton: JetonDegats = zJetonDegats.parse({
    k: "damage",
    actor: params.actorEntityId,
    action: canonicalJson(params.action),
    target: params.targetId,
    critical: params.critical,
    iat: (params.now ?? new Date()).toISOString(),
    nonce: randomUUID(),
  });
  const texte = canonicalJson(jeton);
  const signature = createHmac("sha256", key.secret).update(texte, "utf8").digest("hex");
  return `${Buffer.from(texte, "utf8").toString("base64url")}.${signature}`;
}

/** Le jeton s'il est signé par cette clé, intact et frais ; sinon `null`. */
export function verifyDamageToken(token: string, key: EngineSigningKey, now: Date = new Date()): JetonDegats | null {
  const [corps, signature] = token.split(".");
  if (!corps || !signature || !/^[0-9a-f]{64}$/.test(signature)) return null;
  const texte = Buffer.from(corps, "base64url").toString("utf8");
  const attendue = createHmac("sha256", key.secret).update(texte, "utf8").digest();
  if (!timingSafeEqual(attendue, Buffer.from(signature, "hex"))) return null;
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch (erreur) {
    console.error("Jeton de dégâts illisible", erreur);
    return null;
  }
  const jeton = zJetonDegats.safeParse(brut);
  if (!jeton.success) return null;
  const age = now.getTime() - Date.parse(jeton.data.iat);
  return age >= 0 && age <= DUREE_JETON_MS ? jeton.data : null;
}
