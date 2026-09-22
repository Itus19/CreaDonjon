import { detectEntityReferences, type LinkableEntity } from "../linker/detect";

/**
 * V3-B1 — Lire une intention ecrite en francais, et n'en rien resoudre.
 *
 * Module PUR, et volontairement bete. Il rend une LECTURE de la phrase :
 * quelle action le joueur semble vouloir, sur qui, et sur quels mots cette
 * lecture s'appuie. Il ne lance aucun de, ne calcule aucun modificateur,
 * n'ecrit rien — `turnIntent.ts` fait tout cela ensuite, cote serveur.
 *
 * Deux principes, tous deux issus de l'ADR 0009 :
 *
 * 1. **La correspondance est deterministe.** Meme phrase, meme catalogue,
 *    meme proposition — toujours. Aucune approximation, aucun score, aucun
 *    tirage : quand deux lectures se valent, c'est l'ordre du catalogue et
 *    la position dans le texte qui tranchent, jamais le hasard. L'ecran
 *    affiche la lecture AVANT de lancer, et laisse la corriger ; c'est la
 *    correction humaine qui rattrape, pas une heuristique plus maligne.
 *
 * 2. **Ne pas comprendre est un resultat, pas un echec.** Une phrase non
 *    reconnue tombe en `free` avec sa RAISON. Deviner une action a partir
 *    d'un texte flou reintroduirait exactement ce que le ticket combat :
 *    une mecanique qu'on subit sans l'avoir vue.
 *
 * Le lexique de verbes n'est pas ici : il est en francais, donc dans
 * `src/i18n/fr.ts` (CLAUDE.md, langue). Le noyau ne connait que des termes
 * et des identifiants.
 */

export const MECHANICAL_INTENT_KINDS = ["weapon_attack", "skill_check", "ability_check", "saving_throw"] as const;
export type MechanicalIntentKind = (typeof MECHANICAL_INTENT_KINDS)[number];

export interface IntentAction {
  /** Identifiant rendu tel quel a l'executeur : id d'objet d'inventaire, cle de competence, cle de caracteristique. */
  id: string;
  kind: MechanicalIntentKind;
  /** Ce que l'ecran affiche dans la proposition. */
  label: string;
  /** Ce qu'un joueur ECRIT pour la designer. Le premier terme n'a aucun privilege. */
  terms: string[];
}

export interface IntentTarget {
  id: string;
  label: string;
  terms: string[];
}

export interface IntentVerb {
  terms: string[];
  kind: MechanicalIntentKind;
  /**
   * Action designee sans ambiguite par ce verbe ("fouiller" -> investigation).
   * Absent : le verbe ne dit que la FAMILLE ("frapper" -> une attaque,
   * laquelle reste a choisir dans le catalogue).
   */
  actionId?: string;
}

export interface IntentCatalog {
  /** Ce que CE personnage peut faire, dans l'ordre ou l'ecran les propose. */
  actions: IntentAction[];
  /** Les presents de la scene, l'acteur exclu — on ne se prend jamais soi-meme pour cible. */
  targets: IntentTarget[];
  verbs: IntentVerb[];
}

/**
 * `aucun_verbe_reconnu` : rien dans la phrase ne designe une mecanique.
 * `aucune_action_disponible` : la famille etait comprise, mais ce
 * personnage n'a rien pour l'incarner (aucune arme equipee, competence
 * absente de la fiche). Distinguer les deux est ce qui permet a l'ecran de
 * dire POURQUOI il n'a pas propose de jet.
 */
export type FreeIntentReason = "aucun_verbe_reconnu" | "aucune_action_disponible";

export interface FreeIntent {
  kind: "free";
  text: string;
  reason: FreeIntentReason;
  /** Renseigne seulement pour `aucune_action_disponible`. */
  wantedKind?: MechanicalIntentKind;
}

export interface MechanicalIntent {
  kind: "mechanical";
  actionKind: MechanicalIntentKind;
  action: IntentAction;
  target: IntentTarget | null;
  /**
   * Les mots du texte qui ont produit cette lecture, tels qu'ecrits. C'est
   * ce que l'ecran montre pour que le joueur voie ce que le moteur a
   * compris — le point qui, d'apres le ticket, supprime la frustration du
   * « ce n'est pas ce que je voulais faire ».
   */
  matched: { verb: string | null; action: string | null; target: string | null };
}

export type IntentProposal = FreeIntent | MechanicalIntent;

function linkable(items: readonly { id: string; terms: string[] }[]): LinkableEntity[] {
  return items
    .filter((item) => item.terms.length > 0)
    .map((item) => ({ id: item.id, name: item.terms[0], aliases: item.terms.slice(1) }));
}

/**
 * Premiere occurrence, dans le TEXTE, d'un des candidats retenus par
 * `predicate`. `detectEntityReferences` rend deja ses correspondances dans
 * l'ordre du texte, la plus longue d'abord a position egale (V0-05) : on
 * herite donc de « épée longue » plutot que « épée » sans rien recoder.
 */
function firstMatch<T extends { id: string; terms: string[] }>(
  text: string,
  items: readonly T[],
  predicate: (item: T) => boolean = () => true
): { item: T; matchedText: string } | null {
  if (!items.some(predicate)) return null;

  // La detection porte sur TOUS les items, pas seulement les eligibles :
  // un terme non eligible qui en recouvre un eligible doit continuer de le
  // masquer, sinon le filtre changerait le decoupage de la phrase.
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const reference of detectEntityReferences(text, linkable(items))) {
    for (const candidate of reference.candidates) {
      const item = byId.get(candidate.entityId);
      if (item && predicate(item)) return { item, matchedText: reference.matchedText };
    }
  }
  return null;
}

/** Les verbes n'ont pas d'identifiant propre : leur rang dans le lexique en tient lieu. */
function indexedVerbs(verbs: readonly IntentVerb[]): (IntentVerb & { id: string })[] {
  return verbs.map((verb, index) => ({ ...verb, id: String(index) }));
}

export function interpretIntent(rawText: string, catalog: IntentCatalog): IntentProposal {
  const text = rawText.trim();
  const free = (reason: FreeIntentReason, wantedKind?: MechanicalIntentKind): FreeIntent =>
    wantedKind ? { kind: "free", text, reason, wantedKind } : { kind: "free", text, reason };

  if (text.length === 0) return free("aucun_verbe_reconnu");

  const verbHit = firstMatch(text, indexedVerbs(catalog.verbs));
  const targetHit = firstMatch(text, catalog.targets);
  const target = targetHit ? { target: targetHit.item, matchedText: targetHit.matchedText } : null;

  // Aucun verbe : une action nommee seule suffit ("persuasion"), sinon on
  // ne devine pas.
  if (!verbHit) {
    const actionHit = firstMatch(text, catalog.actions);
    if (!actionHit) return free("aucun_verbe_reconnu");
    return {
      kind: "mechanical",
      actionKind: actionHit.item.kind,
      action: actionHit.item,
      target: target?.target ?? null,
      matched: { verb: null, action: actionHit.matchedText, target: target?.matchedText ?? null },
    };
  }

  const wantedKind = verbHit.item.kind;
  const mechanical = (action: IntentAction, actionText: string | null): MechanicalIntent => ({
    kind: "mechanical",
    actionKind: action.kind,
    action,
    target: target?.target ?? null,
    matched: { verb: verbHit.matchedText, action: actionText, target: target?.matchedText ?? null },
  });

  // Un verbe qui designe SA competence l'impose : « fouiller » est
  // Investigation, meme si l'inventaire contient une loupe. Absente de la
  // fiche, l'intention tombe en action libre en le DISANT — c'est la
  // reponse honnete, pas un jet approchant.
  if (verbHit.item.actionId !== undefined) {
    const action = catalog.actions.find((a) => a.id === verbHit.item.actionId && a.kind === wantedKind);
    return action ? mechanical(action, null) : free("aucune_action_disponible", wantedKind);
  }

  // Le verbe ne dit que la famille : une action nommee de CETTE famille
  // l'emporte, sinon la premiere du catalogue — l'ordre du catalogue est la
  // decision, et l'ecran laisse en changer d'un clic.
  const namedAction = firstMatch(text, catalog.actions, (a) => a.kind === wantedKind);
  if (namedAction) return mechanical(namedAction.item, namedAction.matchedText);

  const fallback = catalog.actions.find((a) => a.kind === wantedKind);
  return fallback ? mechanical(fallback, null) : free("aucune_action_disponible", wantedKind);
}
