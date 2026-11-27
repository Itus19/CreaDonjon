import { SeededRng } from "../dice/rng";
import { seedFromId } from "./priceList";
import type { TriggerZone } from "./triggers";

/**
 * ADR 0121, point 2 — Qui entre dans un combat en solo, et de quel côté.
 *
 * Le moteur décide, jamais le récit (règle 8). Fonction pure, à graine fixe :
 * les mêmes présents avec les mêmes liens donnent les mêmes camps. Elle se
 * relance à chaque fin de round : un renfort arrive, un défenseur lâche.
 *
 * Les liens sont les axes de relation de la partie (`entity_attitudes`,
 * -100 à 100), lus par le serveur et passés ici déjà rétrécis :
 * `amitie` (friendship_hostility), `dette` (debt_independence), `peur`
 * (fear_assurance, positif : il le craint). `impulsivite` est le pôle
 * `impulse_prudence` du tempérament (positif : impulsif).
 */

export interface LiensEnvers {
  amitie?: number;
  dette?: number;
  peur?: number;
}

export interface PresentAuCombat {
  id: string;
  /** Sa zone par rapport à la personne qui joue. */
  zone: TriggerZone;
  /** L'archétype de vie (ADR 0115) : `garde`, `enfant`, `vieillard`… */
  archetype: string | null;
  impulsivite?: number;
  /** Ses liens envers l'agresseur et la cible, par identifiant. */
  envers: Record<string, LiensEnvers>;
}

export type ReactionHorsCombat = "fuit" | "se_cache" | "appelle_a_l_aide";

export interface CampsDuCombat {
  /** L'agresseur d'abord, puis ceux qui le suivent, dans l'ordre des présents. */
  agresseurs: string[];
  /** La cible d'abord, puis ceux qui la défendent. */
  defenseurs: string[];
  /** Ceux qui restent au dehors, avec ce qu'ils font : pas de rang d'initiative. */
  horsCombat: { id: string; reaction: ReactionHorsCombat }[];
  /** Les présents loin : rien au premier round, recalculés à la fin du round. */
  plusTard: string[];
}

/** La bande « fort » des relations (`bands.ts`, strong_pos) : en dessous, on regarde sans s'en mêler. */
export const SEUIL_LIEN_FORT = 34;
/** La bande « terrifié » (extreme_pos de fear_assurance) : même un impulsif reste dehors. */
const SEUIL_TERREUR = 67;

const NE_SE_BATTENT_PAS = new Set(["enfant", "vieillard"]);
const REACTIONS: readonly ReactionHorsCombat[] = ["fuit", "se_cache", "appelle_a_l_aide"];

function lienFort(liens: LiensEnvers | undefined): number {
  return Math.max(liens?.amitie ?? 0, liens?.dette ?? 0);
}

/** Le courage : la peur de l'adversaire retient un réfléchi dès « craintif », un impulsif seulement s'il est terrifié. */
function retenuParLaPeur(p: PresentAuCombat, adversaireId: string): boolean {
  const peur = p.envers[adversaireId]?.peur ?? 0;
  if (peur >= SEUIL_TERREUR) return true;
  return peur >= SEUIL_LIEN_FORT && (p.impulsivite ?? 0) < SEUIL_LIEN_FORT;
}

export function campsDuCombat(params: {
  agresseurId: string;
  cibleId: string;
  presents: readonly PresentAuCombat[];
  /** Le lieu relève de la garde présente (une ville, pas une route déserte). */
  juridictionGarde: boolean;
  /** Stable pour une même scène et un même combat (l'identifiant du combat, par exemple). */
  graine: string;
}): CampsDuCombat {
  const { agresseurId, cibleId } = params;
  const camps: CampsDuCombat = { agresseurs: [agresseurId], defenseurs: [cibleId], horsCombat: [], plusTard: [] };
  const rng = new SeededRng(seedFromId(params.graine));
  const agresseurEstGarde = params.presents.find((p) => p.id === agresseurId)?.archetype === "garde";

  const dehors = (id: string) => camps.horsCombat.push({ id, reaction: REACTIONS[rng.nextInt(REACTIONS.length)]! });

  for (const p of params.presents) {
    if (p.id === agresseurId || p.id === cibleId) continue;
    if (p.zone === "far") {
      camps.plusTard.push(p.id);
      continue;
    }
    if (p.archetype !== null && NE_SE_BATTENT_PAS.has(p.archetype)) {
      dehors(p.id);
      continue;
    }

    // La garde fait respecter l'ordre : contre celui qui frappe, sauf quand c'est l'un des siens.
    if (p.archetype === "garde" && params.juridictionGarde) {
      (agresseurEstGarde ? camps.agresseurs : camps.defenseurs).push(p.id);
      continue;
    }

    const versCible = lienFort(p.envers[cibleId]);
    const versAgresseur = lienFort(p.envers[agresseurId]);
    if (versCible >= SEUIL_LIEN_FORT && versCible > versAgresseur && !retenuParLaPeur(p, agresseurId)) camps.defenseurs.push(p.id);
    else if (versAgresseur >= SEUIL_LIEN_FORT && versAgresseur > versCible && !retenuParLaPeur(p, cibleId)) camps.agresseurs.push(p.id);
    else dehors(p.id);
  }

  return camps;
}
