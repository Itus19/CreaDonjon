import type { IntentCatalog } from "@/src/core/rules/intent";

/**
 * V3-B1 — Ce qui traverse la frontiere client/serveur pour un tour solo.
 *
 * Ces types vivent ici, et pas dans `src/server/services/turnIntent.ts`,
 * pour une raison mecanique : ce service porte `import "server-only"`, et
 * la barre d'intention est un composant client. Meme en `import type`,
 * pointer un module serveur depuis le client est une invitation a
 * l'accident le jour ou l'import cesse d'etre un type.
 */

/** `entity:<uuid>` (un present de la scene) ou `participant:<uuid>` (une ligne de combat). Le prefixe dit ou relire la cible. */
export type TargetId = string;

export interface IntentTargetDetail {
  id: TargetId;
  label: string;
  /** `null` pour un present de scene sans ligne de combat : sans CA, une attaque n'a pas de verdict, et on ne l'invente pas. */
  ac: number | null;
  hpCurrent: number | null;
  source: "combat" | "scene";
}

export interface IntentBarData {
  actor: { entityId: string; name: string };
  catalog: IntentCatalog;
  targetDetails: IntentTargetDetail[];
}

export interface TurnRecord {
  /** `roll` des qu'un de est tombe, `player_action` pour une action libre — les deux `kind` existants de `session_events`, jamais un nouveau. */
  kind: "roll" | "player_action";
  /**
   * Les faits etablis, en phrases. C'est ce que V3-B2 donnera au modele —
   * deja resolus, deja journalises. Le modele les habille, il ne les
   * produit pas.
   */
  facts: string[];
  /** `null` hors campagne : sans campagne il n'y a pas de session ou journaliser. */
  eventId: string | null;
  detail: Record<string, unknown>;
}
