import { PLAYER_EDITABLE_FIELDS, type PlayerEditableField } from "@/src/core/campaigns/tableSettings";

/** Les commandes de la fiche jouable : `true` = montrer la commande du champ (V3.1-109). */
export type CommandesFiche = Record<PlayerEditableField, boolean>;

function toutesA(valeur: boolean): CommandesFiche {
  return Object.fromEntries(PLAYER_EDITABLE_FIELDS.map((champ) => [champ, valeur])) as CommandesFiche;
}

/** Aucune commande : l'état tant que la fiche calculée n'est pas arrivée, pour ne jamais montrer un geste que le serveur refusera. */
export const AUCUNE_COMMANDE: CommandesFiche = toutesA(false);

/** Toutes les commandes : le MJ, une fiche hors campagne, le mode solo. */
export const TOUTES_LES_COMMANDES: CommandesFiche = toutesA(true);

/** Ce que la fiche doit montrer : les `controls` du serveur, ou rien tant qu'ils ne sont pas là. */
export function commandesDeLaFiche(controls: CommandesFiche | undefined): CommandesFiche {
  return controls ?? AUCUNE_COMMANDE;
}
