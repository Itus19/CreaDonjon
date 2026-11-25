/**
 * Narration solo — à quel PNJ présent le joueur adresse-t-il la parole ?
 *
 * Le code le décide, pas le modèle : un petit modèle local oublie souvent de
 * faire répondre la personne à qui l'on parle, ou fait parler quelqu'un
 * d'autre. Quand ce tour désigne clairement un PNJ, `narrateSoloTurn` exige sa
 * réplique (`npc_reaction`) et réessaie une fois si elle manque.
 *
 * Volontairement prudent : il faut à la fois un signe de parole (guillemets,
 * deux-points, point d'interrogation ou verbe de parole) ET un mot entier du
 * nom d'un PNJ présent. Dans le doute on rend `null`, et le modèle choisit
 * seul, guidé par la consigne générale du prompt.
 */

export interface AddressableNpc {
  id: string;
  name: string;
}

/** Mots d'un nom qui ne désignent personne à eux seuls (« Mabelle, du Fanal », « le Borgne »). */
const MOTS_VIDES = new Set(["les", "des", "dit", "dite", "von", "van"]);

/** Taille minimale d'un mot de nom pour qu'il compte : « du », « le », « de » ne désignent personne. */
const LONGUEUR_MIN = 3;

const VERBES_DE_PAROLE =
  /\b(demande|demander|dis|dit|dire|parle|parler|reponds|repond|repondre|salue|saluer|interpelle|interpeller|questionne|questionner|appelle|appeler|crie|murmure|chuchote|explique|raconte|propose|supplie|ordonne|lance|annonce)\b/;

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function contientParole(action: string): boolean {
  return /["«»“”:?]/.test(action) || VERBES_DE_PAROLE.test(normaliser(action));
}

function echapper(mot: string): string {
  return mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** L'id du PNJ à qui le joueur parle, ou `null` si ce n'est pas clair. */
export function npcAddressedBy(playerAction: string, npcs: AddressableNpc[]): string | null {
  if (npcs.length === 0 || !contientParole(playerAction)) return null;
  const action = normaliser(playerAction);

  let meilleur: { id: string; position: number } | null = null;
  for (const npc of npcs) {
    const mots = normaliser(npc.name)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((m) => m.length >= LONGUEUR_MIN && !MOTS_VIDES.has(m));
    for (const mot of mots) {
      const trouve = new RegExp(`(?<![\\p{L}\\p{N}])${echapper(mot)}(?![\\p{L}\\p{N}])`, "u").exec(action);
      if (trouve && (meilleur === null || trouve.index < meilleur.position)) {
        meilleur = { id: npc.id, position: trouve.index };
      }
    }
  }
  return meilleur?.id ?? null;
}

const VERBES_DE_QUESTION = /\b(demande|demandes|demander|interroge|interroger|questionne|questionner)\b/;

/**
 * Le joueur attend-il une RÉPONSE parlée ? Une question (point
 * d'interrogation) ou un verbe qui demande. Seul ce cas justifie d'exiger la
 * réplique d'un PNJ et de réessayer si elle manque : saluer, accepter, ou
 * s'engager dans une tâche n'appelle pas forcément de dialogue, et un PNJ qui
 * parle à chaque tour rend la scène bavarde et plate (retour de jeu du
 * 25 novembre 2026).
 */
export function estQuestionDirecte(playerAction: string): boolean {
  return playerAction.includes("?") || VERBES_DE_QUESTION.test(normaliser(playerAction));
}
