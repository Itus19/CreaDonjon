import { z } from "zod";

/**
 * Forme que l'IA doit produire pour l'assistance redactionnelle (V1-F3,
 * specs/arbitrage-modifications.md : "insertion au curseur, longueurs").
 * Volontairement du texte brut, sans noeud de reference ni identifiant :
 * c'est ce qui rend vrai le garde-fou anti-hallucination ("le modele ne
 * peut referencer que des identifiants fournis dans le contexte du tour",
 * SCHEMA.md §16.2) au niveau le plus simple possible — il n'y a
 * structurellement rien a inventer, l'entite et le bloc cibles sont fixes
 * cote serveur depuis la route, jamais lus dans la sortie du modele
 * (`Object.keys` ne contient jamais que `text`, meme si l'appelant essaie
 * d'y glisser un id).
 *
 * Converti en `Segment` (paragraphe, une seule marque) par
 * `src/server/ai/writingAssist.ts` au moment de creer la proposition —
 * jamais par le modele lui-meme.
 */
export const zTextProposal = z.object({
  text: z.string().min(1).max(2000),
});
export type TextProposal = z.infer<typeof zTextProposal>;

/** Schema JSON de l'appel d'outil (contrat, meme motif que weaponProposalToolSchema, V1-F2). */
export const textProposalToolSchema = {
  type: "object",
  properties: {
    text: { type: "string", description: "Le texte narratif propose, en francais, sans mise en forme" },
  },
  required: ["text"],
} as const;
