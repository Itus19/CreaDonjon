import { normalizeForMatching } from "../linker/normalize";
import { paragrapheNomme } from "./concealedMarks";

/**
 * V3.2-80 (ADR 0122, point 3) — Le personnage cache un objet qu'il porte
 * (« je cache ma dague sous ma cape »), ou le remet en vue (« je sors la
 * lettre »).
 *
 * Cacher passe par un jet de Discrétion ou d'Escamotage que le moteur a déjà
 * lancé ; réussi, son total devient le DD secret pour trouver l'objet, comme
 * l'action Se cacher de D&D 2024. Seule une fouille ou un regard attentif qui
 * l'atteint le découvre (`facetsRevealedByCheck`). Le montrer ne demande pas
 * de jet.
 */

export interface ObjetDuSac {
  id: string;
  name: string;
  concealed: boolean;
}

const mots = (s: string) => normalizeForMatching(s).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * L'objet du sac que la phrase nomme : le nom entier d'abord (le plus long
 * gagne, « épée longue » avant « épée »), sinon un seul objet dont le premier
 * mot apparaît. Rien si c'est ambigu.
 */
export function objetNomme(text: string, items: readonly ObjetDuSac[]): string | null {
  const phrase = ` ${mots(text).join(" ")} `;
  const entiers = items.filter((i) => mots(i.name).length > 0 && phrase.includes(` ${mots(i.name).join(" ")} `));
  if (entiers.length > 0) return [...entiers].sort((a, b) => b.name.length - a.name.length)[0]!.id;
  const parTete = items.filter((i) => {
    const tete = mots(i.name)[0];
    return tete !== undefined && tete.length >= 4 && phrase.includes(` ${tete} `);
  });
  return parTete.length === 1 ? parTete[0]!.id : null;
}

const MONTRER =
  /\b(sors|sort|sortir|montre|montrer|devoile|devoiler|degaine|degainer|brandis|brandir|exhibe|exhiber|enleve|enlever|retire|retirer|decouvre|decouvrir|ote|otes|oter|defais|defait|defaire|releve|relever)\b/;

/**
 * V3.2-84 — Ce qui dit qu'on cache quelque chose, et pas seulement qu'on se
 * cache : un verbe de dissimulation, une chose qui couvre (un bandage, une
 * capuche), ou glisser un objet DANS ou SOUS quelque chose. « Je glisse une
 * pièce au marchand » ou « je me faufile, la dague à la main » ne cachent rien.
 */
const CACHER =
  /\b(cache|caches|cacher|dissimule|dissimules|dissimuler|escamote|escamoter|couvre|couvres|couvrir|recouvre|recouvrir|camoufle|camoufler|planque|planquer|enfouis|enfouit|enfouir|rabats|rabat|rabattre|bandage|bandeau|pansement|foulard|echarpe|capuche|capuchon|voile|masque|gant|gants|manche|col)\b|\bgliss\w*\b.*\b(dans|sous)\b/;
const DD_MIN = 5;
const DD_MAX = 30;

/** V3.2-81 : un signe distinctif de la description (un paragraphe), caché ou montré comme un objet. */
export interface SigneDistinctif {
  id: string;
  text: string;
  concealed: boolean;
}

export type GesteDeDissimulation =
  | { itemId: string; concealed: true; concealDc: number }
  | { itemId: string; concealed: false }
  | { markId: string; concealed: true; concealDc: number }
  | { markId: string; concealed: false };

export function gesteDeDissimulation(params: {
  intent: { kind: string; actionId: string | null };
  check: { total: number; verdict: "success" | "fail" | null } | null;
  text: string;
  items: readonly ObjetDuSac[];
  /** V3.2-81 — les paragraphes de sa description, pour « je cache mon tatouage sous un bandage ». Un objet nommé passe avant. */
  signes?: readonly SigneDistinctif[];
}): GesteDeDissimulation | null {
  const signes = params.signes ?? [];
  const cacher = params.intent.kind === "skill_check" && (params.intent.actionId === "stealth" || params.intent.actionId === "sleight_of_hand");
  if (cacher) {
    if (params.check?.verdict !== "success" || !CACHER.test(normalizeForMatching(params.text))) return null;
    const concealDc = Math.min(DD_MAX, Math.max(DD_MIN, params.check.total));
    const id = objetNomme(params.text, params.items.filter((i) => !i.concealed));
    if (id) return { itemId: id, concealed: true, concealDc };
    const markId = paragrapheNomme(params.text, signes.filter((m) => !m.concealed));
    return markId ? { markId, concealed: true, concealDc } : null;
  }
  if (!MONTRER.test(normalizeForMatching(params.text))) return null;
  const id = objetNomme(params.text, params.items.filter((i) => i.concealed));
  if (id) return { itemId: id, concealed: false };
  const markId = paragrapheNomme(params.text, signes.filter((m) => m.concealed));
  return markId ? { markId, concealed: false } : null;
}
