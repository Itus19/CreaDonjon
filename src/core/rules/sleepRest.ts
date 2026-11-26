import { DAY_MINUTES, type GameTime } from "./scene";

/**
 * Le repos long quand le personnage dort dans le récit (décidé par
 * l'auteur le 26 novembre 2026, fil « Faire avancer l'intrigue en narration
 * solo ») : le moteur l'applique seul, après avoir vérifié les règles.
 *
 * Le sommeil vient TOUJOURS du texte de la personne qui joue, jamais de la
 * narration : une ellipse est sa décision (ADR 0112, amendement). Fonctions
 * pures : aucune lecture, aucune écriture.
 */

/** Règles 2024 : un repos long dure 8 heures. */
export const LONG_REST_MIN_MINUTES = 8 * 60;
/** Règles 2024 : après un repos long, 16 heures avant d'en commencer un autre. */
export const LONG_REST_COOLDOWN_MINUTES = 16 * 60;

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Les répliques entre guillemets sont des paroles, pas des actions : « tu dors ? » ne fait dormir personne. */
function sansParoles(texte: string): string {
  return texte.replace(/«[^»]*»/g, " ").replace(/"[^"]*"/g, " ").replace(/“[^”]*”/g, " ");
}

const SOMMEIL = [
  /\bje dors\b/,
  /\bon dort\b/,
  /\bdormir\b/,
  /\bm'endor(s|mir)\b/,
  /\bs'endormir\b/,
  /\b(je )?(me|nous) couch(e|er|ons)\b/,
  /\b(vais|va|aller|vas) au lit\b/,
  /\brepos long\b/,
  /\blong repos\b/,
  /\bnuit de sommeil\b/,
];

const NEGATION = [/\bne dor(s|t|mir)\b/, /\bn'arrive pas a dormir\b/, /\bsans dormir\b/, /\bpas dormir\b/, /\bne (me )?couche pas\b/];

/** Le joueur a-t-il écrit que son personnage dort ? */
export function sommeilDemande(texteJoueur: string): boolean {
  const texte = sansAccents(sansParoles(texteJoueur));
  if (NEGATION.some((re) => re.test(texte))) return false;
  return SOMMEIL.some((re) => re.test(texte));
}

export type IssueRepos = "applique" | "trop_court" | "trop_tot";

function enMinutes(t: GameTime): number {
  return t.day * DAY_MINUTES + t.hour * 60 + t.minute;
}

/**
 * Combien de temps passe, et si ce sommeil vaut un repos long.
 * `null` : rien à décider (pas de sommeil demandé, ou combat en cours).
 * Sans durée écrite, dormir vaut huit heures : c'est le joueur qui a choisi l'ellipse.
 */
export function decideLongRest(input: {
  sommeil: boolean;
  minutesEcrites: number | null;
  enCombat: boolean;
  maintenant: GameTime;
  /** La FIN du dernier repos long, ou `null`. */
  dernierRepos: GameTime | null;
}): { minutes: number; repos: IssueRepos } | null {
  if (!input.sommeil || input.enCombat) return null;
  const minutes = input.minutesEcrites ?? LONG_REST_MIN_MINUTES;
  if (minutes < LONG_REST_MIN_MINUTES) return { minutes, repos: "trop_court" };
  if (input.dernierRepos && enMinutes(input.maintenant) - enMinutes(input.dernierRepos) < LONG_REST_COOLDOWN_MINUTES) return { minutes, repos: "trop_tot" };
  return { minutes, repos: "applique" };
}

/** La phrase qui part dans les changements du tour (vue à l'écran, lue par la narration). */
export function phraseRepos(issue: IssueRepos): string {
  switch (issue) {
    case "applique":
      return "Repos long : points de vie au maximum, la moitié des dés de vie, les emplacements de sort et les ressources sont restaurés, épuisement −1.";
    case "trop_court":
      return "Moins de 8 heures de sommeil : ce n'est pas un repos long.";
    case "trop_tot":
      return "Un repos long a déjà pris fin il y a moins de 16 heures : ce sommeil ne compte pas comme un nouveau repos long.";
  }
}
