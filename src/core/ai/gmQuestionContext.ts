import { fenceUntrustedData } from "./promptSafety";
import { LIGHTING_LABELS, npcLine, questLine, type TurnContextInput, type TurnContextNpc, type TurnContextQuest } from "./turnContext";

/**
 * V3-D4 — Le contexte envoyé au modèle pour répondre à une question du
 * joueur POSÉE HORS DU TEMPS DE JEU (le bouton « MJ », jamais « Jouer »).
 *
 * **Même scène, même PNJ, mêmes quêtes que `buildTurnContext`** (V3-B3) —
 * réutilisés tels quels, jamais une seconde lecture du monde — mais sans
 * `facts`/`changes`/`hints` : rien n'a été résolu, il n'y a rien à
 * raconter. La question elle-même reste HORS de l'encadrement, même
 * raison que `playerAction` dans `buildTurnContext` : c'est le texte du
 * joueur, jamais une donnée du monde.
 */

export interface GmQuestionContextInput {
  locationName: TurnContextInput["locationName"];
  time: TurnContextInput["time"];
  lighting: TurnContextInput["lighting"];
  npcs: TurnContextNpc[];
  quests: TurnContextQuest[];
  recentNarrations: string[];
  question: string;
}

export function buildGmQuestionContext(input: GmQuestionContextInput): string {
  const locationText = `${input.locationName} — jour ${input.time.day}, ${String(input.time.hour).padStart(2, "0")}h${String(input.time.minute).padStart(2, "0")} — ${LIGHTING_LABELS[input.lighting]}`;

  const parts: (string | null)[] = [
    fenceUntrustedData("lieu", locationText),
    input.npcs.length > 0 ? fenceUntrustedData("pnjs-presents", input.npcs.map(npcLine).join("\n")) : null,
    input.quests.length > 0 ? fenceUntrustedData("quetes-en-cours", input.quests.map(questLine).join("\n")) : null,
    input.recentNarrations.length > 0
      ? fenceUntrustedData("dernieres-narrations", input.recentNarrations.map((n, i) => `${i + 1}. ${n}`).join("\n"))
      : null,
    `Question du joueur (hors du temps de jeu) : ${input.question}`,
  ];

  return parts.filter((p): p is string => p !== null).join("\n\n");
}
