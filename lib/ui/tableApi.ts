/**
 * Appels de l'outil Table du MJ (V3.1-34), sortis du composant : chacun part
 * d'un geste (un ▲, un « Valider »), jamais d'un chargement après affichage.
 * Le fichier n'a aucun effet de montage (cliquet du câblage, docs/CABLAGE.md §6).
 *
 * Chaque geste passe par la même route que la fiche (`/api/entities/[id]/actions/…`),
 * donc par le même service et le même journal. Après un geste, on relit CE PJ
 * (`/sheet`), jamais toute la table. Le client décrit le geste, jamais le
 * résultat (règle 8) ; les erreurs sont rendues, jamais avalées.
 */
import type { Currency } from "@/src/core/rules/currency";
import { messageErreur, posterJet } from "./outilDesApi";
import type { EtatPj } from "./outilTable";

/** `erreur` : le message du serveur, ou `null` quand il n'en a pas donné (l'appelant affiche alors son texte par défaut). */
export type Resultat<T> = { ok: true; donnees: T } | { ok: false; erreur: string | null };

async function lireReponse<T>(res: Response, lire: (corps: unknown) => T | null): Promise<Resultat<T>> {
  if (!res.ok) {
    const message = await messageErreur(res, "");
    return { ok: false, erreur: message === "" ? null : message };
  }
  const corps: unknown = await res.json().catch(() => null);
  const donnees = lire(corps);
  if (donnees === null) return { ok: false, erreur: null };
  return { ok: true, donnees };
}

/** Une route de geste (`hp`, `xp`, `long-rest`…). `corps` contient déjà `campaignId`. */
export async function posterGeste<T = unknown>(
  entityId: string,
  action: string,
  corps: object,
  lire: (corps: unknown) => T | null = (c) => c as T
): Promise<Resultat<T>> {
  try {
    const res = await posterJet(`/api/entities/${entityId}/actions/${action}`, corps);
    if (res.status === 204) return { ok: true, donnees: {} as T };
    return await lireReponse(res, lire);
  } catch (erreur) {
    console.error(`Geste « ${action} » impossible`, erreur);
    return { ok: false, erreur: null };
  }
}

function estObjet(corps: unknown): corps is Record<string, unknown> {
  return !!corps && typeof corps === "object";
}

function lireEtatPj(corps: unknown): EtatPj | null {
  if (!estObjet(corps) || !estObjet(corps.sheet) || !estObjet(corps.runtimeState) || !estObjet(corps.hitDiceTotals)) return null;
  return corps as unknown as EtatPj;
}

/** L'état d'un seul PJ, même forme que `sheet`/`runtimeState` du chargement. */
export async function relirePj(entityId: string, campaignId: string | null): Promise<Resultat<EtatPj>> {
  try {
    const res = await fetch(`/api/entities/${entityId}/sheet?campaignId=${campaignId ?? ""}`);
    return await lireReponse(res, lireEtatPj);
  } catch (erreur) {
    console.error("Relecture du PJ impossible", erreur);
    return { ok: false, erreur: null };
  }
}

/** La bourse que renvoie la route `currency` (le bloc d'inventaire écrit). */
export function lireBourse(corps: unknown): Currency | null {
  if (!estObjet(corps) || !estObjet(corps.data) || !estObjet(corps.data.currency)) return null;
  return corps.data.currency as unknown as Currency;
}
