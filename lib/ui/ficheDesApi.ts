import type { CombatParticipantRow } from "@/src/server/repos/combats";
import { ErreurLancer } from "@/lib/ui/outilDes";
import { lireCombat, listerCombats } from "@/lib/ui/initiativeApi";

/**
 * Appels des boutons d'attaque, de dégâts et de sort de la fiche (V3.1-106),
 * sortis des composants : ils partent d'un geste (le toucher d'un bouton ou
 * « Lancer » dans l'outil de dés), jamais d'un chargement après affichage. Aucun
 * effet de montage ici (docs/CABLAGE.md §6).
 */

/** Une route de la fiche (`/api/entities/[id]/actions/<chemin>`) : le serveur lance et rend le jet complet. Un échec lève une `ErreurLancer` dont le message est AFFICHÉ dans l'outil. */
export async function posterActionFiche<T>(entityId: string, chemin: string, corps: object, parDefaut: string): Promise<T> {
  const res = await fetch(`/api/entities/${entityId}/actions/${chemin}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  const reponse: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = reponse && typeof reponse === "object" && typeof (reponse as { error?: unknown }).error === "string" ? (reponse as { error: string }).error : parDefaut;
    throw new ErreurLancer(message);
  }
  return reponse as T;
}

export interface CombatEnCours {
  combatId: string;
  participants: CombatParticipantRow[];
}

/**
 * Le combat `running` de la campagne et ses participants, lus AU TOUCHER d'un
 * bouton du MJ (deux GET : la liste, puis le détail du combat en cours). `null`
 * hors initiative : le jet reste alors un simple jet.
 */
export async function lireCombatEnCours(campaignId: string, parDefaut: string): Promise<CombatEnCours | null> {
  try {
    const { combats } = await listerCombats(campaignId, parDefaut);
    const enCours = combats.find((c) => c.status === "running");
    if (!enCours) return null;
    const detail = await lireCombat(campaignId, enCours.id, parDefaut);
    return { combatId: enCours.id, participants: detail.participants };
  } catch (e) {
    // Le combat n'a pas pu être lu : le jet reste un simple jet, et la raison reste dans la console.
    console.error("Combat en cours non lu", e);
    return null;
  }
}
