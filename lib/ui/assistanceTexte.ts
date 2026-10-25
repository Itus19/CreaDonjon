/**
 * V3.1-65 — noyau pur de l'encart d'assistance IA du bloc Texte. Le
 * composant (`components/blocks/TextBlockEditor.tsx`) ne fait que brancher :
 * ce qui s'affiche, et si « Proposer » est permis, se decide ici, testable
 * sans navigateur.
 *
 * Deux garanties portees par cette fonction, pas par le JSX :
 *
 * 1. **Rien dans la coquille joueur.** `masquee` ne grise pas le bouton :
 *    elle vide l'encart ET les propositions. Une proposition en attente est
 *    du texte ecrit par un modele, relu par le MJ seul — elle n'a pas a
 *    passer sous les yeux d'un joueur parce qu'il ouvre la meme fiche.
 *
 * 2. **Une proposition reste a cote de la donnee.** `enAttente` rend des
 *    propositions, jamais des segments : rien ici ne peut les fondre dans
 *    `TextBlockData.segments`. C'est ce qui rend vraie la regle 9 cote
 *    interface — le bloc n'est ecrit que par `POST /api/ai-proposals/[id]/
 *    apply`, et seulement sur « Accepter ».
 */

export interface PropositionIa {
  id: string;
  status: "pending" | "rejected";
  payload: { blockId?: string; text?: string };
  validationErrors: { reason?: string } | null;
}

export interface AssistanceTexte {
  /** L'encart existe-t-il, tout simplement. */
  encart: boolean;
  /** Propositions a montrer en pointille, a leur place sous le dernier paragraphe. */
  enAttente: PropositionIa[];
  /** Propositions refusees par la validation, resumees en une ligne chacune. */
  rejetees: PropositionIa[];
  /** « Proposer » est-il permis maintenant. */
  peutProposer: boolean;
}

export function assistanceTexte(input: {
  /** Coquille joueur : l'assistance n'existe pas. */
  masquee: boolean;
  /** Le bloc courant — les propositions des autres blocs de la fiche ne le concernent pas. */
  blockId: string;
  propositions: readonly PropositionIa[];
  /** Ce qu'il reste d'appels dans la fenetre d'une heure ; `null` tant qu'on ne l'a pas lu. */
  budgetRestant: number | null;
  consigne: string;
  /** Un appel est deja en vol. */
  enCours: boolean;
}): AssistanceTexte {
  if (input.masquee) {
    return { encart: false, enAttente: [], rejetees: [], peutProposer: false };
  }

  const miennes = input.propositions.filter((p) => p.payload?.blockId === input.blockId);
  return {
    encart: true,
    enAttente: miennes.filter((p) => p.status === "pending"),
    rejetees: miennes.filter((p) => p.status === "rejected"),
    // `budgetRestant === null` n'interdit rien : ne pas avoir encore lu le
    // budget n'est pas la meme chose que l'avoir epuise, et le serveur
    // refusera de lui-meme (429) si la fenetre est pleine.
    peutProposer: input.consigne.trim().length > 0 && !input.enCours && input.budgetRestant !== 0,
  };
}
