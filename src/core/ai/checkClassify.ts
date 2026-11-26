import { CHECK_TIERS, zCheckClassification, type CheckTier } from "../rules/checkDifficulty";
import { fenceUntrustedData } from "./promptSafety";

/**
 * V3.2-23 (ADR 0113) — demander au modèle si une phrase appelle un jet, et
 * lire sa réponse. Module pur : le message à envoyer, le schéma de l'outil,
 * la lecture de la sortie. L'appel lui-même vit dans
 * `src/server/ai/soloClassify.ts` (règle 12).
 *
 * Le modèle ne choisit qu'une CLÉ dans la liste qu'on lui donne et un
 * palier : jamais un nombre (règle 8). Une clé hors liste, un champ de trop,
 * un palier inconnu : la réponse est écartée, et le tour retombe sur le
 * lexique (V3.2-21).
 */

export type ClassifiableKind = "skill_check" | "ability_check" | "saving_throw";

export interface ClassifiableAction {
  /** Ce que le modèle rend : la clé de compétence (« persuasion »), `test_dex`, `sauvegarde_dex`. */
  key: string;
  kind: ClassifiableKind;
  /** L'identifiant attendu par le tour (clé de compétence ou de caractéristique). */
  id: string;
  label: string;
}

/** Les tests qu'un modèle peut proposer : jamais une attaque, dont la difficulté est la CA de la cible. */
export function classifiableActions(
  skills: readonly { id: string; label: string }[],
  abilities: readonly { id: string; label: string }[]
): ClassifiableAction[] {
  return [
    ...skills.map((s) => ({ key: s.id, kind: "skill_check" as const, id: s.id, label: s.label })),
    ...abilities.map((a) => ({ key: `test_${a.id}`, kind: "ability_check" as const, id: a.id, label: `Test de ${a.label}` })),
    ...abilities.map((a) => ({ key: `sauvegarde_${a.id}`, kind: "saving_throw" as const, id: a.id, label: `Sauvegarde de ${a.label}` })),
  ];
}

export const CHECK_CLASSIFY_TOOL = "classer_action";

/** Le contrat de l'outil, écrit à la main comme `weaponProposalToolSchema` ; la validation réelle reste `zCheckClassification`. */
export function checkClassifyToolSchema(actions: readonly ClassifiableAction[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["none", "trivial", "check"],
        description: "none : rien à tester. trivial : faisable sans risque pour ce personnage. check : l'issue est incertaine et compte.",
      },
      action_id: { type: "string", enum: actions.map((a) => a.key), description: "Seulement pour check : le test à faire." },
      tier: { type: "string", enum: [...CHECK_TIERS], description: "Seulement pour check : la difficulté de la tâche." },
    },
    required: ["kind"],
    additionalProperties: false,
  };
}

const SYSTEM_PROMPT = [
  "Tu aides le moteur d'un jeu de rôle solo (D&D 2024) à décider si l'action du joueur demande un jet de dé.",
  "Tu ne racontes rien et tu ne donnes aucun nombre : tu classes l'action en appelant l'outil `classer_action`, une seule fois.",
  "Règles du MJ : on ne lance un dé que si l'issue est incertaine ET qu'un échec aurait une conséquence.",
  "- none : parler, regarder, se déplacer sans obstacle, se reposer, rêver, penser à quelque chose. Décrire ce qu'on fait sans enjeu.",
  "- trivial : la tâche pourrait se tester, mais ce personnage la réussit sans effort (ouvrir une porte non verrouillée, payer, monter un escalier).",
  "- check : l'issue est incertaine et compte (convaincre quelqu'un qui résiste, escalader un mur glissant, chercher un indice caché, mentir).",
  "Pour check, choisis le test le plus juste dans la liste, puis un palier : tres_facile, facile, moyen (le plus courant), difficile, tres_difficile, quasi_impossible.",
  "Un mot ne suffit pas : « je me raconte une histoire » n'est pas un test d'Histoire.",
].join("\n");

export function buildCheckClassifyMessages(params: {
  text: string;
  actorName: string;
  presents: readonly string[];
  actions: readonly ClassifiableAction[];
}): { system: string; user: string } {
  const liste = params.actions.map((a) => `${a.key} : ${a.label}`).join("\n");
  const presents = params.presents.length > 0 ? params.presents.join(", ") : "personne";
  const user = [
    `Personnage : ${params.actorName}.`,
    `Présents dans la scène : ${presents}.`,
    "Tests possibles (clé : nom) :",
    liste,
    "",
    "Action écrite par le joueur :",
    fenceUntrustedData("action_du_joueur", params.text),
  ].join("\n");
  return { system: SYSTEM_PROMPT, user };
}

/** Ce que le tour fait du classement : une action sans jet (évidente ou non), ou un test au palier donné. */
export type CheckDetection =
  | { kind: "none" }
  | { kind: "trivial" }
  | { kind: "check"; action: ClassifiableAction; tier: CheckTier };

/** `null` : réponse illisible, ou test hors de la liste fournie. Le tour retombe alors sur le lexique. */
export function readCheckClassification(raw: unknown, actions: readonly ClassifiableAction[]): CheckDetection | null {
  const parsed = zCheckClassification.safeParse(raw);
  if (!parsed.success) return null;
  const c = parsed.data;
  if (c.kind !== "check") return { kind: c.kind };
  const action = actions.find((a) => a.key === c.action_id);
  return action ? { kind: "check", action, tier: c.tier } : null;
}
