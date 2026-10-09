/**
 * V3.1-4 — A quel choix revient une competence cliquee dans la grille ?
 *
 * Plusieurs choix de competences peuvent proposer la meme competence (le
 * Guerrier propose Athletisme, le trait humain « Competent » les propose
 * toutes). La grille n'a qu'un rond par competence : il faut donc un seul
 * choix par competence, et il depend de ce qui est deja coche :
 * 1. le choix qui l'a deja retenue (pour pouvoir la decocher) ;
 * 2. sinon le premier, dans l'ordre donne, qui la propose et a encore de la place ;
 * 3. sinon le premier qui la propose (le rond reste alors non selectionnable).
 */
export interface RoutableSkillChoice {
  id: string;
  count: number;
  options: readonly string[];
}

function chosenOf(choices: Record<string, unknown>, id: string): readonly unknown[] {
  const value = choices[id];
  return Array.isArray(value) ? value : [];
}

export function routeSkillChoices<C extends RoutableSkillChoice>(skillChoices: readonly C[], chosenById: Record<string, unknown>): Map<string, C> {
  const map = new Map<string, C>();
  const skills = new Set(skillChoices.flatMap((c) => c.options));
  for (const skill of skills) {
    const offering = skillChoices.filter((c) => c.options.includes(skill));
    const route =
      offering.find((c) => chosenOf(chosenById, c.id).includes(skill)) ??
      offering.find((c) => chosenOf(chosenById, c.id).length < c.count) ??
      offering[0];
    map.set(skill, route);
  }
  return map;
}
