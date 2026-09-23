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
  /** `null` si le lieu a ete supprime entre-temps — pas de lien a poser sur une fiche introuvable (V3-D2). */
  locationSlug: string | null;
  /**
   * Le parent `part_of` direct du lieu de la scene, s'il en a un et s'il
   * est lui-meme un lieu (V3-D2, en-tete d'etat) — "la ville la plus
   * proche" au sens le plus litteral : le prochain conteneur, jamais la
   * racine de toute la hierarchie. `null` si le lieu n'a pas de parent, ou
   * si son parent n'est pas un lieu.
   */
  nearestCity: { name: string; slug: string } | null;
  time: { day: number; hour: number; minute: number };
  lighting: "bright" | "dim" | "dark";
  inCombat: boolean;
  present: {
    entityId: string;
    name: string;
    zone: "engaged" | "near" | "far";
    /** Un mot sur l'attitude ("mefiant"), pose a l'entree en scene — `undefined` : rien n'ecrit ce champ aujourd'hui (V3-D3, colonne Présents). */
    disposition?: string;
  }[];
}

/**
 * V3-D3 — La colonne gauche, onglet Wiki : une entree deja resolue en nom,
 * slug et court extrait (premier paragraphe visible a CE joueur,
 * `resolveEntityRefExcerpts`). Aucun marqueur de decouverte : la donnee qui
 * le porterait (`entity_discoveries`) n'est jamais ecrite avant V3-C4.
 */
export interface WikiColumnEntry {
  id: string;
  name: string;
  slug: string;
  /** `null` : aucun bloc `text` visible sur cette fiche — la colonne l'affiche comme "Rien d'écrit pour l'instant.", jamais comme une erreur. */
  excerpt: string | null;
}

export interface WikiColumnGroup {
  /** `entity_kind` brut ("location", "pnj"...) — cle React, le libelle francais vit dans `label`. */
  kind: string;
  label: string;
  entries: WikiColumnEntry[];
}

/** V3-D3, onglet Quêtes — un objectif deja resolu, jamais de reference brute côté client. */
export interface QuestColumnObjective {
  id: string;
  text: string;
  done: boolean;
}

export interface QuestColumnEntry {
  /** L'id du bloc `quest` — stable, jamais reconstruit a partir du titre. */
  id: string;
  title: string;
  /** `null` : sans donneur, ou donneur non resolu (une reference de regle, hors de portee de ce ticket). */
  giverName: string | null;
  /** Les recompenses de la quete, deja jointes en une phrase — `null` si aucune n'est renseignee. */
  rewardText: string | null;
  objectives: QuestColumnObjective[];
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
