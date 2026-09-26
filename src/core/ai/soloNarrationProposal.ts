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
export function soloNarrationSchema(npcIds: string[]) {
  const npcIdSet = new Set(npcIds);
  return z
    .object({
      narration: z.string().min(1).max(1000),
      npc_reaction: z.object({ npc_id: z.string().min(1), text: z.string().min(1).max(400) }).optional(),
      /** V3-C2 — jamais un nom : un ROLE seulement, le generateur tire l'identite. */
      new_character: z.object({ role: z.string().min(1).max(200) }).optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (!value.npc_reaction) return;
      if (npcIdSet.size === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["npc_reaction"], message: "aucun PNJ present, aucune reaction possible" });
      } else if (!npcIdSet.has(value.npc_reaction.npc_id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["npc_reaction", "npc_id"], message: "identifiant de PNJ inconnu — jamais invente" });
      }
    });
}
export type SoloNarrationProposal = z.infer<ReturnType<typeof soloNarrationSchema>>;

export function soloNarrationToolSchema(npcIds: string[]) {
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
    },
    required: ["narration"],
  } as const;
}
