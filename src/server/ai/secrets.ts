import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * V3.1-224 (ADR 0103) — la clé d'API d'un compte, chiffrée par l'application.
 *
 * Pourquoi ici et pas dans la base : `pgcrypto` ferait passer la valeur en
 * clair dans la requête SQL, donc potentiellement dans les journaux du serveur
 * de base. Chiffrée avant de partir, elle ne quitte jamais ce processus en
 * clair.
 *
 * `AI_SECRETS_KEY` : 64 caractères hexadécimaux (32 octets), serveur seulement
 * — jamais derrière `NEXT_PUBLIC_` (règle absolue 1). Même discipline que
 * `ENGINE_SIGNING_KEY` (docs/CLE-MOTEUR.md) : la poser est un geste manuel.
 *
 * Format stocké : `v1:<iv>:<tag>:<chiffré>`, chaque partie en base64. Le
 * préfixe de version existe pour pouvoir changer d'algorithme sans deviner ce
 * qu'on relit.
 */

const VERSION = "v1";
const ALGO = "aes-256-gcm";

export class SecretKeyAbsente extends Error {
  constructor() {
    super("AI_SECRETS_KEY doit être posée (64 caractères hexadécimaux) pour enregistrer une clé d'API.");
    this.name = "SecretKeyAbsente";
  }
}

function cle(): Buffer {
  const hex = process.env.AI_SECRETS_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) throw new SecretKeyAbsente();
  return Buffer.from(hex, "hex");
}

/** Vrai si l'application peut chiffrer — l'écran s'en sert pour dire pourquoi il refuse, plutôt que d'écrire un secret en clair. */
export function chiffrementDisponible(): boolean {
  const hex = process.env.AI_SECRETS_KEY;
  return typeof hex === "string" && /^[0-9a-fA-F]{64}$/.test(hex);
}

export function chiffrerSecret(clair: string): string {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv(ALGO, cle(), iv);
  const chiffre = Buffer.concat([chiffreur.update(clair, "utf8"), chiffreur.final()]);
  return [VERSION, iv.toString("base64"), chiffreur.getAuthTag().toString("base64"), chiffre.toString("base64")].join(":");
}

/**
 * Rend `null` plutôt que de jeter quand le texte stocké n'est pas déchiffrable
 * (clé changée, ligne écrite à la main) : l'appel d'IA se comporte alors comme
 * un compte sans fournisseur — le tour reste joué, l'écran le dit (V3.1-223).
 */
export function dechiffrerSecret(blob: string): string | null {
  const parts = blob.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const dechiffreur = createDecipheriv(ALGO, cle(), Buffer.from(parts[1], "base64"));
    dechiffreur.setAuthTag(Buffer.from(parts[2], "base64"));
    return Buffer.concat([dechiffreur.update(Buffer.from(parts[3], "base64")), dechiffreur.final()]).toString("utf8");
  } catch {
    // catch-attendu : AES-GCM lève DÈS QUE l'authentification ne passe pas — clé de
    // chiffrement changée, texte altéré, ligne écrite à la main. C'est le comportement
    // documenté de `final()`, et c'est précisément ce qu'on veut détecter. Ne jamais
    // journaliser ici : la valeur et la cause exacte renseigneraient un attaquant qui
    // essaie des variantes. L'appelant traite ce `null` comme « pas de fournisseur ».
    return null;
  }
}
