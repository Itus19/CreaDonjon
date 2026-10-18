/**
 * Panneau « Identité de l'application » (V3.1-88) : la règle d'envoi du logo,
 * pure pour être testée sans interface.
 */

/** Ce que le superadmin a retenu : un des douze dessins, ou le logo téléversé. */
export type ChoixLogo = "dessin" | "televerse";
export type ActionLogo = "keep" | "remove" | "upload";

/** Au départ, le logo téléversé est retenu s'il existe. */
export function choixInitial(logoUrl: string | null): ChoixLogo {
  return logoUrl ? "televerse" : "dessin";
}

/**
 * Fichier choisi et retenu -> « upload » ; logo téléversé existant mais un
 * dessin retenu -> « remove » ; sinon « keep ».
 */
export function actionLogo({
  choix,
  fichierChoisi,
  televerseExistant,
}: {
  choix: ChoixLogo;
  fichierChoisi: boolean;
  televerseExistant: boolean;
}): ActionLogo {
  if (choix === "televerse" && fichierChoisi) return "upload";
  if (choix === "dessin" && televerseExistant) return "remove";
  return "keep";
}
