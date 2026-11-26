/**
 * V3.2-20 — le fait d'un jet, sans le DD (ou la CA) ni l'issue.
 *
 * Quand la personne qui joue a choisi de ne pas voir l'issue de ses jets
 * (réglage de partie `solo_show_outcome`), le fil montre le dé et le total,
 * et c'est le récit qui dit si l'on a réussi. Le fait complet reste tel quel
 * dans le journal et part tel quel au narrateur : seul l'affichage change.
 *
 * On retire ce que `turnIntent.ts` ajoute avec des gabarits fixes : « contre
 * DD 13 », « contre CA 15 », « — réussite », « — échec », « — touché »,
 * « — raté ». « — critique » et « — échec critique » restent : ils se lisent
 * déjà sur le dé (un 20, un 1). Le lien avec ces gabarits est gardé par les
 * tests de ce fichier.
 */
const SEUIL = / contre (?:DD|CA) \d+/g;
const ISSUE = / — (?:réussite|échec|touché|raté)(?=\.| — |$)/g;

export function factSansIssue(fact: string): string {
  return fact.replace(SEUIL, "").replace(ISSUE, "");
}
