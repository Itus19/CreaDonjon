import { normalizeForMatching } from "../linker/normalize";

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

const MONTRER = /\b(sors|sort|sortir|montre|montrer|devoile|devoiler|degaine|degainer|brandis|brandir|exhibe|exhiber)\b/;
const DD_MIN = 5;
const DD_MAX = 30;

export type GesteDeDissimulation = { itemId: string; concealed: true; concealDc: number } | { itemId: string; concealed: false };

export function gesteDeDissimulation(params: {
  intent: { kind: string; actionId: string | null };
  check: { total: number; verdict: "success" | "fail" | null } | null;
  text: string;
  items: readonly ObjetDuSac[];
}): GesteDeDissimulation | null {
  const cacher = params.intent.kind === "skill_check" && (params.intent.actionId === "stealth" || params.intent.actionId === "sleight_of_hand");
  if (cacher) {
    if (params.check?.verdict !== "success") return null;
    const id = objetNomme(params.text, params.items.filter((i) => !i.concealed));
    return id ? { itemId: id, concealed: true, concealDc: Math.min(DD_MAX, Math.max(DD_MIN, params.check.total)) } : null;
  }
  if (!MONTRER.test(normalizeForMatching(params.text))) return null;
  const id = objetNomme(params.text, params.items.filter((i) => i.concealed));
  return id ? { itemId: id, concealed: false } : null;
}
