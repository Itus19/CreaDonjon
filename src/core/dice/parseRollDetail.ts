/**
 * Extraction pure du detail d'un jet (`dice_rolls.detail`, V2-M11) — partagee
 * entre `DiceRollPanel.tsx` (affichage du volet) et le panneau de stats de
 * l'ecran d'accueil joueur (retour utilisateur), jamais dupliquee : les deux
 * doivent compter/afficher exactement les memes des a partir de la meme
 * trace serveur.
 */

export interface RollChip {
  label: string;
  value: number;
}

export interface RollDetail {
  who?: string;
  what?: string;
  chips?: RollChip[];
  dc?: number | null;
  verdict?: "success" | "fail" | null;
  trace?: { text: string; value: number }[];
}

export interface DiceGroup {
  faces: number;
  rolls: number[];
}

export function parseRollDetail(detail: unknown): RollDetail {
  return detail && typeof detail === "object" ? (detail as RollDetail) : {};
}

// Forme "N... (v1, v2) = total" (src/core/formula/evaluate.ts, diceLabel +
// trace du cas "dice") — seul format jamais produit pour un pas de trace de
// des, jamais reconstruit depuis l'AST : une regex sur ce format stable
// suffit a retrouver les faces reellement lancees, sans reimplementer le
// moteur de formules cote client.
const DICE_TRACE_RE = /^(\d+)d(\d+)(?:kh\d+|kl\d+)?\s*\(([^)]*)\)\s*=\s*-?\d+$/;

export function extractDiceGroups(trace: { text: string; value: number }[] | undefined): DiceGroup[] {
  if (!trace) return [];
  const groups: DiceGroup[] = [];
  for (const step of trace) {
    const m = DICE_TRACE_RE.exec(step.text);
    if (!m) continue;
    const rolls = m[3]
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (rolls.length > 0) groups.push({ faces: Number(m[2]), rolls });
  }
  return groups;
}
