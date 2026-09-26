import { z } from "zod";

/**
 * V3-B2 (câblage de la narration) — Généralise `spikeSoloProposal.ts` (S2,
 * trois PNJ codés en dur, `zSpikeTurnProposal` figé sur leurs identifiants)
 * à un tour réel : le garde-fou anti-hallucination reste le même
 * (`npc_id` est un enum FERMÉ, jamais une chaîne libre), mais l'ensemble
 * varie d'un tour à l'autre — il vient des PNJ réellement présents dans la
 * scène (V3-B3, `buildSoloTurnContext`), pas d'une liste figée au code.
 *
 * Sans PNJ présent, `npc_reaction` disparaît du schéma plutôt que
 * d'accepter un enum vide (`z.enum` refuse une liste vide) — cohérent avec
 * la scène : personne à qui faire réagir.
 *
 * **V3-C3 — `world_note` suit le MÊME garde-fou**, sur un enum séparé
 * (`knownEntityIds` : le lieu et les PNJ RÉELS de la scène, jamais une
 * esquisse — elle n'a pas de fiche à enrichir). Une suggestion rédactionnelle
 * n'est jamais écrite directement : elle devient une ligne `ai_proposals`
 * `pending`, relue par un humain (V1-F3, `applyAiProposal`/`rejectAiProposal`,
 * `src/server/services/aiProposals.ts`).
 */

/**
 * Une seule FORME de retour quels que soient les PNJ presents (`npc_reaction`
 * toujours present dans le type, jamais une union conditionnelle) : sinon
 * chaque appelant devrait re-etablir lui-meme, a la lecture, quelle forme il
 * a reçue — la meme classe de bogue que deviner un type au lieu de le
 * verifier. La fermeture reelle de l'enum, elle, reste conditionnelle
 * (`z.enum` refuse une liste vide) ; `superRefine` rejette explicitement
 * toute `npc_reaction` quand `npcIds` est vide, plutot que de laisser Zod
 * ignorer silencieusement une cle inconnue.
 */
export function soloNarrationSchema(npcIds: string[], knownEntityIds: string[] = []) {
  const npcIdSet = new Set(npcIds);
  const knownEntityIdSet = new Set(knownEntityIds);
  return z
    .object({
      narration: z.string().min(1).max(1000),
      npc_reaction: z.object({ npc_id: z.string().min(1), text: z.string().min(1).max(400) }).optional(),
      /** V3-C2 — jamais un nom : un ROLE seulement, le generateur tire l'identite. */
      new_character: z.object({ role: z.string().min(1).max(200) }).optional(),
      /** V3-C3 — une suggestion redactionnelle, jamais ecrite directement : elle passe par `ai_proposals`, en attente d'une relecture humaine. */
      world_note: z.object({ entity_id: z.string().min(1), text: z.string().min(1).max(400) }).optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.npc_reaction) {
        if (npcIdSet.size === 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["npc_reaction"], message: "aucun PNJ present, aucune reaction possible" });
        } else if (!npcIdSet.has(value.npc_reaction.npc_id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["npc_reaction", "npc_id"], message: "identifiant de PNJ inconnu — jamais invente" });
        }
      }
      if (value.world_note) {
        if (knownEntityIdSet.size === 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["world_note"], message: "aucune entite connue de ce tour, aucune suggestion possible" });
        } else if (!knownEntityIdSet.has(value.world_note.entity_id)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["world_note", "entity_id"], message: "identifiant d'entite inconnu — jamais invente" });
        }
      }
    });
}
export type SoloNarrationProposal = z.infer<ReturnType<typeof soloNarrationSchema>>;

export function soloNarrationToolSchema(npcIds: string[], knownEntityIds: string[] = []) {
  return {
    type: "object",
    properties: {
      narration: { type: "string", description: "2 a 4 phrases de narration en francais, jamais de calcul ni de jet" },
      ...(npcIds.length > 0
        ? {
            npc_reaction: {
              type: "object",
              description: "Optionnel : un PNJ present reagit a ce tour",
              properties: {
                npc_id: { type: "string", enum: npcIds, description: "Identifiant EXACT d'un PNJ present, jamais invente" },
                text: { type: "string", description: "La reaction du PNJ, une phrase" },
              },
              required: ["npc_id", "text"],
            },
          }
        : {}),
      new_character: {
        type: "object",
        description:
          "Optionnel : un personnage incident, absent de la liste, doit reagir MAINTENANT. Ne lui donne JAMAIS de nom ni de trait toi-meme : decris seulement son role, le moteur tire son identite.",
        properties: {
          role: { type: "string", description: "Le role ou la fonction du personnage, jamais un nom (ex: \"le tavernier\", \"une elfe au comptoir\")" },
        },
        required: ["role"],
      },
      ...(knownEntityIds.length > 0
        ? {
            world_note: {
              type: "object",
              description:
                "Optionnel : une phrase a suggerer pour enrichir la fiche d'un lieu ou d'un PNJ REELLEMENT dans ce tour — jamais applique directement, un humain la relira.",
              properties: {
                entity_id: { type: "string", enum: knownEntityIds, description: "Identifiant EXACT d'une entite de ce tour, jamais invente" },
                text: { type: "string", description: "La phrase suggeree, un seul fait" },
              },
              required: ["entity_id", "text"],
            },
          }
        : {}),
    },
    required: ["narration"],
  } as const;
}
