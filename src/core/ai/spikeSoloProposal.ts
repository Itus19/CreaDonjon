import { z } from "zod";

/**
 * V2-S1 (spike de viabilite du solo) : trois PNJ jetables, donnees
 * litterales codees en dur — PAS le vrai bloc `personality` (poles,
 * aspirations, `entity_attitudes`...), qui est le travail de V2-H1. Ce
 * spike teste seulement si un modele local peut narrer correctement quand
 * le contexte est deterministe ; il n'a pas a construire Lot H en avance
 * pour ca.
 */
export const SPIKE_NPCS = [
  {
    id: "b6a1e001-0000-4000-8000-000000000001",
    name: "Grelin",
    blurb: "Un habitue taciturne, toujours assis pres de la porte.",
    priority: "prudence avant tout",
    line: "ne trahira jamais un ami",
    stanceTowardBram: "mefiant : le soupconne de trafics avec des inconnus.",
  },
  {
    id: "b6a1e001-0000-4000-8000-000000000002",
    name: "Soeur Aude",
    blurb: "Une pretresse itinerante de passage pour la nuit.",
    priority: "altruisme",
    line: "ne mentira jamais sur sa foi",
    stanceTowardBram: "reconnaissante : Bram l'a hebergee gratuitement une fois.",
  },
  {
    id: "b6a1e001-0000-4000-8000-000000000003",
    name: "Ktar",
    blurb: "Un mercenaire de passage, l'air pragmatique.",
    priority: "l'argent avant l'honneur",
    line: "ne se bat jamais sans etre paye",
    stanceTowardBram: "interesse : le voit comme une source de contrats.",
  },
] as const;

const NPC_IDS = SPIKE_NPCS.map((n) => n.id) as [string, ...string[]];

/**
 * Forme que le modele doit produire pour un tour (V2-S1). Le garde-fou
 * anti-hallucination est structurel : `npc_id` est un enum ferme sur les
 * trois identifiants reels fournis en contexte — toute autre valeur fait
 * echouer le parse Zod, compte comme "identifiant invente" dans les
 * mesures du spike.
 */
export const zSpikeTurnProposal = z.object({
  narration: z.string().min(1).max(1000),
  npc_reaction: z
    .object({
      npc_id: z.enum(NPC_IDS),
      text: z.string().min(1).max(400),
    })
    .optional(),
});
export type SpikeTurnProposal = z.infer<typeof zSpikeTurnProposal>;

export const spikeTurnToolSchema = {
  type: "object",
  properties: {
    narration: { type: "string", description: "2 a 4 phrases de narration en francais, jamais de calcul ni de jet" },
    npc_reaction: {
      type: "object",
      description: "Optionnel : un PNJ present reagit a ce tour",
      properties: {
        npc_id: { type: "string", enum: NPC_IDS, description: "Identifiant EXACT d'un PNJ present, jamais invente" },
        text: { type: "string", description: "La reaction du PNJ, une phrase" },
      },
      required: ["npc_id", "text"],
    },
  },
  required: ["narration"],
} as const;

/** Texte des trois PNJ pour le contexte du tour (donnee, encadree par fenceUntrustedData a l'appel). */
export function buildSpikeNpcContext(): string {
  return SPIKE_NPCS.map(
    (n) => `- ${n.name} (id: ${n.id}) : ${n.blurb} Priorite : ${n.priority}. Limite : ${n.line}. Envers Bram : ${n.stanceTowardBram}`
  ).join("\n");
}
