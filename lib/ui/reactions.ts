import { z } from "zod";

/**
 * V3.1-161 (ADR 0075) — les fenêtres de réaction, côté écran : la liste en
 * attente qu'entretient `SauvegardesProvider` (même canal temps réel), ce que
 * chacun a à répondre, et les fenêtres fermées que l'auteur doit reprendre.
 * Pur : aucune requête ici (docs/CABLAGE.md).
 */

export const zChoixReaction = z.object({
  /** `null` : la réaction est au MJ (monstre). */
  user_id: z.string().nullable(),
  actor_label: z.string(),
  rule_key: z.string(),
  activation_id: z.string(),
  label: z.string(),
  /** `null` : le serveur ne sait pas (jet sans seuil connu). */
  changes_outcome: z.boolean().nullable(),
});
export type ChoixReaction = z.infer<typeof zChoixReaction>;

/** Une fenêtre telle que l'écran la connaît : la ligne lisible de `roll_windows`, reçue avec la page ou en temps réel. */
export const zFenetreReaction = z.object({
  id: z.string(),
  label: z.string(),
  view: z.object({ total: z.number(), natural: z.number().nullable(), outcome: z.string().nullable() }),
  choices: z.array(zChoixReaction),
  answers: z.record(z.string(), z.object({ use: z.boolean() }).passthrough()),
  status: z.string(),
  author_user_id: z.string(),
  resumed_at: z.string().nullable(),
  created_at: z.string(),
});
export type FenetreReaction = z.infer<typeof zFenetreReaction>;

/** Les lignes lues par le layout vers les fenêtres de l'écran ; une ligne illisible est écartée (elle se recale au signal suivant). */
export function fenetresDepuisLignes(lignes: readonly unknown[]): FenetreReaction[] {
  return lignes.flatMap((l) => {
    const lue = zFenetreReaction.safeParse(l);
    return lue.success ? [lue.data] : [];
  });
}

export interface EtatReactions {
  /** Ouvertes, la plus ancienne d'abord. */
  enAttente: FenetreReaction[];
  /** Fermées depuis l'ouverture de la page et pas encore reprises (seul l'auteur les reprend). */
  fermees: FenetreReaction[];
}

/** Un signal du canal temps réel ; `ligne` n'est pas encore vérifiée. */
export type SignalReaction = { type: "INSERT" | "UPDATE"; ligne: unknown } | { type: "DELETE"; id: string };

function parOrdreDArrivee(a: FenetreReaction, b: FenetreReaction): number {
  return a.created_at.localeCompare(b.created_at);
}

/**
 * Applique un signal à l'état. Une ligne d'une forme inattendue est ignorée
 * (l'état revient identique) : la liste se recale au prochain chargement.
 */
export function appliquerSignalReaction(etat: EtatReactions, signal: SignalReaction): EtatReactions {
  if (signal.type === "DELETE") {
    if (!etat.enAttente.some((f) => f.id === signal.id) && !etat.fermees.some((f) => f.id === signal.id)) return etat;
    return { enAttente: etat.enAttente.filter((f) => f.id !== signal.id), fermees: etat.fermees.filter((f) => f.id !== signal.id) };
  }
  const lue = zFenetreReaction.safeParse(signal.ligne);
  if (!lue.success) return etat;
  const ligne = lue.data;
  const enAttente = etat.enAttente.filter((f) => f.id !== ligne.id);
  const fermees = etat.fermees.filter((f) => f.id !== ligne.id);
  if (ligne.status === "pending") return { enAttente: [...enAttente, ligne].sort(parOrdreDArrivee), fermees };
  return { enAttente, fermees: ligne.status === "closed" && ligne.resumed_at === null ? [...fermees, ligne] : fermees };
}

export interface QuiReagit {
  userId: string | null;
  isMj: boolean;
}

/** Une ligne que l'utilisateur doit trancher : sa fenêtre, son rang dans `choices`, et le choix lui-même. */
export interface LigneAReponde {
  fenetreId: string;
  index: number;
  choix: ChoixReaction;
}

/**
 * Les lignes à répondre : celles à son nom, plus (MJ) celles sans joueuse, pas
 * encore répondues. Cosmétique : la barrière est `answer_roll_window` en base.
 */
export function lignesARepondre(fenetres: readonly FenetreReaction[], qui: QuiReagit): LigneAReponde[] {
  if (!qui.userId) return [];
  return fenetres.flatMap((f) =>
    f.choices.flatMap((choix, index) => {
      const maLigne = choix.user_id === qui.userId || (choix.user_id === null && qui.isMj);
      return maLigne && f.answers[String(index)] === undefined ? [{ fenetreId: f.id, index, choix }] : [];
    })
  );
}

/** La pastille du dé encoché : mes lignes à répondre, où qu'on soit. */
export function compteReactions(fenetres: readonly FenetreReaction[], qui: QuiReagit): number {
  return lignesARepondre(fenetres, qui).length;
}

/** Les fenêtres que le bandeau montre : celles où j'ai à répondre ; le MJ les voit toutes (pour « Continuer »). */
export function fenetresAffichees(fenetres: readonly FenetreReaction[], qui: QuiReagit): FenetreReaction[] {
  if (qui.isMj) return [...fenetres];
  const miennes = new Set(lignesARepondre(fenetres, qui).map((l) => l.fenetreId));
  return fenetres.filter((f) => miennes.has(f.id));
}

/** Les fenêtres de l'utilisateur fermées sans qu'il les ait reprises : l'écran les reprend une fois. */
export function fenetresAReprendre(fermees: readonly FenetreReaction[], userId: string | null): FenetreReaction[] {
  if (!userId) return [];
  return fermees.filter((f) => f.author_user_id === userId && f.resumed_at === null);
}

/** V3.1-161 : la liste lue avec la page, rangée en ouvertes et fermées pas encore reprises. */
export function separerFenetres(fenetres: readonly FenetreReaction[]): EtatReactions {
  return {
    enAttente: fenetres.filter((f) => f.status === "pending"),
    fermees: fenetres.filter((f) => f.status === "closed" && f.resumed_at === null),
  };
}
