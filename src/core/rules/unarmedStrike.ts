/**
 * V3.2-70 — La Frappe à mains nues (SRD 5.2) : toute créature sait la porter,
 * sans arme équipée. Jet d'attaque avec la Force et le bonus de maîtrise ;
 * dégâts contondants égaux à 1 + le modificateur de Force, sans dé (un
 * critique ne double donc rien). Les deux autres usages de la frappe,
 * empoigner et pousser (sauvegarde contre 8 + Force + maîtrise), viendront
 * avec le combat en solo (V3.2-66).
 *
 * Fonction pure : la fiche dérivée fournit les deux nombres (règle 16).
 */

/** L'identifiant de l'action dans le catalogue du tour : aucun objet d'inventaire ne le porte. */
export const UNARMED_ACTION_ID = "unarmed";

/** Les mots qui la font reconnaître dans une phrase (« je lui donne un coup de poing »). */
export const UNARMED_TERMS_FR = ["mains nues", "à mains nues", "poing", "coup de poing", "coup de pied", "coup de tête", "gifle"];

export interface UnarmedStrike {
  attackModifier: number;
  damage: number;
  damageType: "bludgeoning";
}

export function unarmedStrike(params: { strMod: number; proficiencyBonus: number }): UnarmedStrike {
  return {
    attackModifier: params.strMod + params.proficiencyBonus,
    damage: Math.max(0, 1 + params.strMod),
    damageType: "bludgeoning",
  };
}
