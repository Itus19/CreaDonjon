/**
 * Resume de la ligne « Competences » repliee de la fiche etroite (V3.1-29) :
 * combien de competences sont maitrisees, et la meilleure valeur. Pure, pour
 * se tester sans fiche ni DOM.
 */

export interface CompetenceResumee {
  nom: string;
  mod: number;
  /** `half` (Touche-à-tout, V3.1-46) ne compte pas comme une maîtrise. */
  proficiency: "none" | "half" | "proficient" | "expertise";
}

export interface ResumeCompetences {
  /** Competences maitrisees ou en expertise. */
  maitrisees: number;
  /** La plus haute valeur de toute la liste (la premiere en cas d'egalite), `null` si la liste est vide. */
  meilleure: { nom: string; mod: number } | null;
}

export function resumerCompetences(competences: CompetenceResumee[]): ResumeCompetences {
  let meilleure: ResumeCompetences["meilleure"] = null;
  let maitrisees = 0;
  for (const c of competences) {
    if (c.proficiency === "proficient" || c.proficiency === "expertise") maitrisees += 1;
    if (meilleure === null || c.mod > meilleure.mod) meilleure = { nom: c.nom, mod: c.mod };
  }
  return { maitrisees, meilleure };
}
