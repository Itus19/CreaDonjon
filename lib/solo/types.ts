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

/**
 * La scène courante, ses identifiants déjà résolus en noms (V3-B2). Le
 * client n'a jamais à retraduire un `uuid` : le serveur envoie ce qui
 * s'affiche.
 */
export interface SceneView {
  locationId: string;
  locationName: string;
  time: { day: number; hour: number; minute: number };
  lighting: "bright" | "dim" | "dark";
  inCombat: boolean;
  present: { entityId: string; name: string; zone: "engaged" | "near" | "far" }[];
}

/**
 * Un tour complet (V3-B2) : le jet, puis ce que les déclencheurs ont
 * réveillé, appliqué et persisté. Le fil de l'écran affiche les deux —
 * d'abord le fait, ensuite ce qu'il a changé.
 */
export interface TurnOutcome {
  record: TurnRecord;
  /** En français, dans l'ordre d'application : « Gobelin 2 : 7 → 2 PV ». */
  changes: string[];
  /** Les `narrate_hint` des règles déclenchées — pour la narration (V3-B4), jamais pour la mécanique. */
  hints: string[];
  /** Ce que le moteur n'a PAS pu appliquer, avec sa raison. Jamais tu. */
  ignored: string[];
  /** L'heure de jeu après le tour, `null` si la campagne n'a pas encore de scène. */
  time: { day: number; hour: number; minute: number } | null;
}
