import { z } from "zod";

/**
 * V3.1-112 (ADR 0044) — les sauvegardes demandées, côté écran : la liste en
 * attente qu'entretient `SauvegardesProvider`, les issues revenues, et ce que
 * chacun a à répondre. Pur : aucune requête ici (docs/CABLAGE.md).
 */

/** Une demande telle que l'écran la connaît : la vue du serveur, ou une ligne reçue en temps réel. */
export const zDemandeSauvegarde = z.object({
  id: z.string(),
  label: z.string(),
  ability: z.string(),
  dc: z.number(),
  status: z.string(),
  combat_id: z.string().nullable(),
  target_id: z.string(),
  target_entity_id: z.string().nullable(),
  target_user_id: z.string().nullable(),
  author_user_id: z.string(),
  natural_roll: z.number().nullable(),
  total: z.number().nullable(),
  created_at: z.string(),
});
export type DemandeSauvegarde = z.infer<typeof zDemandeSauvegarde>;

/** L'issue d'une sauvegarde répondue : ce que l'outil de l'auteur affiche. */
export interface IssueSauvegarde {
  total: number;
  natural: number | null;
  dc: number;
  reussie: boolean;
}

export interface EtatSauvegardes {
  /** En attente, la plus ancienne d'abord. */
  enAttente: DemandeSauvegarde[];
  /** Les issues revenues depuis l'ouverture de la page, par demande. */
  repondues: Record<string, IssueSauvegarde>;
}

/** Un signal du canal temps réel ; `ligne` n'est pas encore vérifiée. */
export type SignalSauvegarde = { type: "INSERT" | "UPDATE"; ligne: unknown } | { type: "DELETE"; id: string };

export function issueDeReponse(ligne: Pick<DemandeSauvegarde, "total" | "natural_roll" | "dc">): IssueSauvegarde | null {
  if (ligne.total === null) return null;
  return { total: ligne.total, natural: ligne.natural_roll, dc: ligne.dc, reussie: ligne.total >= ligne.dc };
}

function parOrdreDArrivee(a: DemandeSauvegarde, b: DemandeSauvegarde): number {
  return a.created_at.localeCompare(b.created_at);
}

/**
 * Applique un signal à l'état. Une ligne d'une forme inattendue est ignorée
 * (l'état revient identique) : la liste se recale au prochain chargement.
 */
export function appliquerSignal(etat: EtatSauvegardes, signal: SignalSauvegarde): EtatSauvegardes {
  if (signal.type === "DELETE") {
    if (!etat.enAttente.some((d) => d.id === signal.id)) return etat;
    return { ...etat, enAttente: etat.enAttente.filter((d) => d.id !== signal.id) };
  }
  const lue = zDemandeSauvegarde.safeParse(signal.ligne);
  if (!lue.success) return etat;
  const ligne = lue.data;
  const autres = etat.enAttente.filter((d) => d.id !== ligne.id);
  if (ligne.status === "pending") {
    return { ...etat, enAttente: [...autres, ligne].sort(parOrdreDArrivee) };
  }
  const issue = ligne.status === "answered" ? issueDeReponse(ligne) : null;
  return {
    enAttente: autres,
    repondues: issue ? { ...etat.repondues, [ligne.id]: issue } : etat.repondues,
  };
}

export interface QuiRepond {
  userId: string | null;
  isMj: boolean;
  /** Les demandes qu'une joueuse a laissées au MJ (« Laisser le MJ saisir »). */
  laisseesAuMj: ReadonlySet<string>;
}

/**
 * Ce que l'utilisateur a à répondre. Le MJ peut répondre à toutes (la base
 * l'y autorise, `answer_save_request`) ; une joueuse aux siennes, moins celles
 * qu'elle a laissées au MJ. Cosmétique : la barrière reste la fonction en base.
 */
export function demandesARepondre(liste: readonly DemandeSauvegarde[], qui: QuiRepond): DemandeSauvegarde[] {
  if (qui.isMj) return [...liste];
  if (!qui.userId) return [];
  return liste.filter((d) => d.target_user_id === qui.userId && !qui.laisseesAuMj.has(d.id));
}

/** La pastille du dé encoché : les demandes à répondre, où qu'on soit. */
export function compteDuDe(liste: readonly DemandeSauvegarde[], qui: QuiRepond): number {
  return demandesARepondre(liste, qui).length;
}

/** L'outil Initiative ne montre que les demandes nées dans le combat ouvert. */
export function demandesDuCombat(liste: readonly DemandeSauvegarde[], combatId: string): DemandeSauvegarde[] {
  return liste.filter((d) => d.combat_id === combatId);
}

/** Qui doit répondre, pour la liste du MJ : la joueuse ciblée (nom connu ou non), sinon le MJ lui-même. */
export type AttenteDeReponse = { qui: "joueuse"; nom: string | null } | { qui: "mj" };

export function attenteDeReponse(demande: Pick<DemandeSauvegarde, "target_user_id">, nom: string | null): AttenteDeReponse {
  return demande.target_user_id ? { qui: "joueuse", nom: nom && nom.trim() !== "" ? nom.trim() : null } : { qui: "mj" };
}

/** Le verdict revenu de la route de réponse, sous la forme que les écrans affichent (le serveur a tranché). */
export function issueDepuisReponse(reponse: { passed: boolean; natural: number | null; total: number }, dc: number): IssueSauvegarde {
  return { total: reponse.total, natural: reponse.natural, dc, reussie: reponse.passed };
}
