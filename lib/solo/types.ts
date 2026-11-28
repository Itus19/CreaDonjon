import type { IntentCatalog } from "@/src/core/rules/intent";
import type { TradeCatalog } from "@/src/core/rules/tradeIntent";
import type { PerceptionPercue } from "@/src/core/psyche/perception";
import type { RaisonSansNarration } from "@/src/core/ai/providerError";

export type { RaisonSansNarration };
import type { PendingRequest } from "@/src/core/schemas/runtimeState";
import type { TraceStep } from "@/src/core/formula/evaluate";

export type { PendingRequest };

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
  /** V3.2-10 : ce qui s'achète, se vend ou se donne ici, et la bourse — lu par `interpretTrade` dans le navigateur. */
  trade: TradeCatalog;
  targetDetails: IntentTargetDetail[];
  /** V3.1-132 : les clés des règles du personnage (aptitudes de classe, d'espèce, dons), pour l'avertissement « règle non jouable » du mode solo. */
  ruleKeys: string[];
  /** À 0 PV, ni stabilisé ni mort : le tour est un jet contre la mort. */
  aTerre?: boolean;
  /** Mort (trois échecs) : en solo, la partie est terminée. */
  mort?: boolean;
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
/** ME-5 — la météo telle que l'écran l'affiche : des clés, libellées par `messages/` (`solo.meteo`). */
export interface SceneWeatherView {
  sky: "clear" | "hazy" | "cloudy" | "overcast";
  precipitation: "none" | "drizzle" | "rain" | "downpour" | "thunderstorm" | "snow" | "sleet" | "hail";
  wind: "calm" | "breeze" | "wind" | "gale";
  fog: boolean;
  temperatureC: number;
  season: "winter" | "spring" | "summer" | "autumn" | null;
  exposure: "outdoor" | "sheltered" | "indoor";
}

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
  /** V3.2-19 — la pièce où se trouve le personnage dans ce lieu (bloc « Pièces » ou esquisse) ; `null` hors de toute pièce. */
  roomName: string | null;
  time: { day: number; hour: number; minute: number };
  lighting: "bright" | "dim" | "dark";
  /**
   * ME-5 (specs/meteo.md) — calculée par le moteur à l'heure de la scène
   * (climat du lieu, saison du calendrier), jamais inventée ni stockée ; avec
   * l'exposition de l'endroit où se tient le personnage (dedans, à l'abri,
   * dehors). `null` : la météo n'a pas pu être calculée.
   */
  weather: SceneWeatherView | null;
  inCombat: boolean;
  present: {
    entityId: string;
    name: string;
    /** ADR 0120 (V3.2-60) : pour ouvrir sa page du wiki dans le volet d'une personne. `null` ou absent : pas de lien. */
    slug?: string | null;
    zone: "engaged" | "near" | "far";
    /** Un mot sur l'attitude ("mefiant"), pose a l'entree en scene — `undefined` : rien n'ecrit ce champ aujourd'hui (V3-D3, colonne Présents). */
    disposition?: string;
    /** V3.2-14 (ADR 0111) : ce que ce present LAISSE VOIR envers le personnage, en bandes. `null` : aucune attitude connue. Absent hors du solo. */
    perception?: PerceptionPercue | null;
  }[];
  /** V3-C2 — les personnages incidents de la scene : un nom et un trait tires au generateur, jamais une fiche. */
  sketches: {
    id: string;
    name: string;
    trait: string;
    zone: "engaged" | "near" | "far";
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
  /** V3.2-19 — la scène après un déplacement proposé par la narration et appliqué par le moteur ; absente sinon. */
  scene?: SceneView;
  /**
   * La narration IA de ce tour (câblage de V3-B2) — `null` dans TOUS les cas
   * où elle n'a pas abouti : pas de fournisseur configuré, appel raté,
   * sortie invalide, hors campagne. Jamais essentiel : le tour ci-dessus
   * est complet et journalisé que ce champ soit rempli ou non.
   */
  narration: { text: string; npcReaction: { npcId: string; text: string } | null } | null;
  /**
   * V3.1-223 — pourquoi `narration` est restée `null`, quand un appel était
   * attendu (tour en campagne) : aucun fournisseur, quota épuisé, clé
   * refusée… Absent quand la narration a abouti ou n'était pas attendue.
   */
  sansNarration?: RaisonSansNarration;
  /** La phrase du fournisseur quand il a refusé l'appel (« 402 : You need a subscription… »), clés masquées. */
  sansNarrationDetail?: string;
}

/**
 * V3-B5 — ce que `POST /api/solo/tour` rend pour un choix MECANIQUE en
 * campagne : rien n'est joue encore, la demande est posee, en attente du
 * nombre que le joueur annoncera (`POST /api/solo/tour/encaisser`).
 */
export interface PendingTurnResponse {
  pending: PendingRequest;
}

/**
 * Un tour dont le jet vient d'etre ENCAISSE — meme forme qu'un tour immediat
 * (`TurnOutcome`), plus la demande de degats CHAINEE quand l'attaque a
 * touche : l'ecran doit alors relancer immediatement un encaissement, sans
 * repasser par une phrase a interpreter.
 */
export interface EncashedTurnOutcome extends TurnOutcome {
  chained: PendingRequest | null;
}

/**
 * V3.1-216 — un encaissement qui n'a pas joué le tour : une réaction peut
 * intervenir sur ce jet. La demande reste posée, rien n'est écrit, et le
 * bandeau de réaction prend la main ; le tour se jouera à la reprise.
 */
export interface FenetreReactionResponse {
  fenetre: string;
}

export type EncashedTurnResponse = EncashedTurnOutcome | FenetreReactionResponse;

/**
 * V3.2-20 — la narration d'un jet déjà encaissé, demandée à part
 * (`POST /api/solo/tour/[eventId]/raconter`) pour que le dé s'affiche sans
 * attendre le modèle. Mêmes champs que dans `TurnOutcome`.
 */
export type NarrationTourResponse = Pick<TurnOutcome, "narration" | "sansNarration" | "sansNarrationDetail" | "time" | "scene">;

/**
 * V3-D4 — le fil, tel que `session_events` le rend. Un item par `kind`
 * RÉELLEMENT écrit par ce module (`turnFil.ts`) — `system` n'existe
 * encore nulle part dans le code : `other` est un repli défensif, jamais un
 * type qu'un appelant doit prévoir en pratique aujourd'hui. `note` (V3-D4
 * Phase 3) est la réponse du MJ à une question posée hors du temps de jeu.
 */
export type FilItem =
  | {
      id: string;
      seq: number;
      createdAt: string;
      kind: "narration";
      text: string;
      /** `npcName`/`attitude` : `null` pour une réplique écrite avant qu'on les garde (le fil montre alors la bulle seule). */
      npcReaction: { npcId: string; text: string; npcName: string | null; attitude: string | null } | null;
    }
  | { id: string; seq: number; createdAt: string; kind: "player_action"; text: string; facts: string[] }
  | {
      id: string;
      seq: number;
      createdAt: string;
      kind: "roll";
      facts: string[];
      total: number | null;
      verdict: "success" | "fail" | null;
      trace: TraceStep[];
      origin: string | null;
      /** V3.2-20 : la phrase du joueur qui a demandé ce jet ; `null` pour des dégâts chaînés ou un jet sans phrase. */
      actionText: string | null;
    }
  | { id: string; seq: number; createdAt: string; kind: "rule_application"; changes: string[]; hints: string[]; ignored: string[] }
  | { id: string; seq: number; createdAt: string; kind: "world_update"; note: string }
  | { id: string; seq: number; createdAt: string; kind: "note"; question: string; answer: string }
  /**
   * V3.2-27 (ADR 0114) — la ligne du tour, sous son dernier événement : l'heure
   * (`null` : pas de relevé), puis ce que le tour a changé. Elle remplace, DANS
   * un tour, les lignes `rule_application` et `world_update`. `last` : le seul
   * tour qu'on peut annuler. Construite à la lecture, jamais écrite.
   */
  | { id: string; seq: number; createdAt: string; kind: "turn_summary"; time: string | null; changes: string[]; hints: string[]; ignored: string[]; worldNotes: number; last: boolean }
  | { id: string; seq: number; createdAt: string; kind: "other"; label: string };
