import { fenceUntrustedData } from "./promptSafety";

/**
 * V3-B3 — Le contexte envoyé au modèle pour narrer un tour solo.
 *
 * Généralise `spikeSoloProposal.buildSpikeNpcContext` (S2/S1, trois PNJ
 * codés en dur) à de vraies données de campagne : la scène, les présents
 * avec leur bande d'attitude nommée, le résultat mécanique du tour, les
 * indices de narration des règles déclenchées, les quêtes actives.
 *
 * **Fonction PURE.** Elle ne lit rien en base — l'appelant (V3-B3, côté
 * service) résout déjà tout : le `known_as` est appliqué, l'attitude est
 * déjà traduite en bande nommée (jamais le nombre), les quêtes sont déjà
 * filtrées par l'audience du joueur. Ce module ne fait que composer et
 * encadrer ; il ne peut donc pas se tromper de viewer, il n'en connaît pas.
 *
 * **Quel contenu est encadré, et lequel ne l'est pas — sans exception, à
 * dessein.** `fenceUntrustedData` (règle absolue 10) protège de la prose
 * qu'un humain — ou un modèle — a écrite : le nom d'un lieu, d'un PNJ, le
 * texte d'une quête, un `narrate_hint` posé sur un déclencheur homebrew,
 * et depuis V3-B4 les dernières narrations elles-mêmes (de la prose de
 * modèle réinjectée, encadrée comme n'importe quelle autre). `facts`/
 * `changes` n'ont besoin d'AUCUN encadrement : ce sont des phrases
 * COMPOSÉES par le serveur à partir de gabarits fixes et de nombres
 * (`turnLoop.ts`/`describeChange`) — B1 l'a déjà posé en principe ("les
 * faits nomment désormais le dé et chaque modificateur... jamais
 * recomposés"). `playerAction` est le texte du joueur lui-même, jamais une
 * donnée du monde. Le test de ce fichier vérifie exactement cette
 * frontière : les cinq premières sont fenced, les trois dernières ne le
 * sont jamais — un sixième champ de "contenu du monde" ajouté ici sans
 * passer par `fenceUntrustedData` casserait ce test.
 *
 * **La consigne « ne répète pas » (V3-B4) reste hors de l'encadrement.**
 * C'est une vraie instruction du système, pas une donnée que le fencing
 * inviterait le modèle à ignorer — la seule ligne de ce fichier qui suit
 * une balise `<donnee>` sans être elle-même encadrée.
 */

export interface TurnContextNpc {
  /** L'id réel de l'entité — jamais inventé, c'est ce qui borne un futur `npc_id` d'outil (même garde-fou que le spike). */
  id: string;
  /** Déjà résolu par `known_as` si le personnage ne connaît pas son vrai nom. */
  name: string;
  /** `null` : aucune attitude suivie pour cette paire — omis plutôt qu'un "neutre" inventé. */
  attitudeLabel: string | null;
  zone: "engaged" | "near" | "far";
}

export interface TurnContextQuest {
  title: string;
  /** Les objectifs NON cochés seulement — ce qui reste à faire, pas l'historique. */
  openObjectives: string[];
}

export interface TurnContextInput {
  locationName: string;
  time: { day: number; hour: number; minute: number };
  lighting: "bright" | "dim" | "dark";
  npcs: TurnContextNpc[];
  quests: TurnContextQuest[];
  /** `record.facts` de `TurnOutcome` (V3-B2) — déjà établis, déjà journalisés. */
  facts: string[];
  /** `changes` de `TurnOutcome`. */
  changes: string[];
  /** `hints` de `TurnOutcome` — les `narrate_hint` des règles déclenchées. Contenu du monde (posé par un auteur de règle) : encadré. */
  hints: string[];
  playerAction: string;
  /**
   * V3-B4 — Les *n* dernières narrations, la plus récente en tête. Contenu
   * ENCADRÉ (c'est de la prose déjà produite par un modèle, réinjectée
   * comme donnée de référence) ; la consigne de ne pas la répéter, elle,
   * reste hors de l'encadrement — c'est une VRAIE instruction du système,
   * pas une donnée du monde que le modèle aurait le droit d'ignorer.
   */
  recentNarrations: string[];
}

/** Exportes : V3-D4 (`gmQuestionContext.ts`) en est le second consommateur — meme lieu, memes PNJ, memes quetes, pour une question hors du temps de jeu plutot qu'une narration de tour. */
export const LIGHTING_LABELS: Record<TurnContextInput["lighting"], string> = {
  bright: "plein jour",
  dim: "pénombre",
  dark: "obscurité",
};

const ZONE_LABELS: Record<TurnContextNpc["zone"], string> = {
  engaged: "au contact",
  near: "à portée",
  far: "au loin",
};

export function npcLine(npc: TurnContextNpc): string {
  const attitude = npc.attitudeLabel ?? "attitude inconnue";
  return `- ${npc.name} (id: ${npc.id}) — ${ZONE_LABELS[npc.zone]}, ${attitude}`;
}

export function questLine(quest: TurnContextQuest): string {
  if (quest.openObjectives.length === 0) return `- ${quest.title}`;
  return `- ${quest.title} : ${quest.openObjectives.join(" ; ")}`;
}

/**
 * Assemble le contexte d'un tour solo, prêt à poser en message `user`
 * derrière `AiProvider` (`src/server/ai/soloNarration.ts`, V3-B2).
 */
export function buildTurnContext(input: TurnContextInput): string {
  const locationText = `${input.locationName} — jour ${input.time.day}, ${String(input.time.hour).padStart(2, "0")}h${String(input.time.minute).padStart(2, "0")} — ${LIGHTING_LABELS[input.lighting]}`;

  const parts: (string | null)[] = [
    fenceUntrustedData("lieu", locationText),
    input.npcs.length > 0 ? fenceUntrustedData("pnjs-presents", input.npcs.map(npcLine).join("\n")) : null,
    input.quests.length > 0 ? fenceUntrustedData("quetes-en-cours", input.quests.map(questLine).join("\n")) : null,
    input.hints.length > 0 ? fenceUntrustedData("indices-de-narration", input.hints.join("\n")) : null,
    // V3-B4 : la prose vient dans l'encadrement (c'est de la donnee de
    // reference, deja produite par un modele), la consigne reste DEHORS —
    // une vraie instruction du systeme, jamais quelque chose que le modele
    // aurait le droit d'ignorer comme "contenu du monde".
    input.recentNarrations.length > 0
      ? `${fenceUntrustedData("dernieres-narrations", input.recentNarrations.map((n, i) => `${i + 1}. ${n}`).join("\n"))}\n\nConsigne : ne répète pas ces phrases ni leurs formulations dans ta nouvelle narration.`
      : null,
    `Faits établis de ce tour :\n${input.facts.length > 0 ? input.facts.map((f) => `- ${f}`).join("\n") : "(aucun)"}`,
    input.changes.length > 0 ? `Changements :\n${input.changes.map((c) => `- ${c}`).join("\n")}` : null,
    `Action du joueur : ${input.playerAction}`,
  ];

  return parts.filter((p): p is string => p !== null).join("\n\n");
}
