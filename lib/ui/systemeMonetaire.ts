import type { CurrencySystem } from "@/src/core/rules/currency";
import { zCurrencySystemBlockData } from "@/src/core/schemas/rule-blocks/blocks";

/**
 * V3.1-220 (ADR 0102) — le formulaire du bloc `currency_system`. Il édite un
 * brouillon de chaînes (une valeur à moitié tapée reste affichable), puis
 * `systemeDe` le convertit et le valide par le schéma du bloc : la même
 * validation que le serveur, qui revalide de toute façon.
 */
export interface BrouillonPiece {
  key: string;
  fr: string;
  en: string;
  /** Valeur en pièces de cuivre, telle que tapée. */
  valeur: string;
  role: "common" | "reserve";
}

export interface BrouillonSysteme {
  pieces: BrouillonPiece[];
  /** L'ordre de casse des réserves ; recalé sur les rôles par `systemeDe`. */
  ordre: string[];
}

export function brouillonDe(system: CurrencySystem): BrouillonSysteme {
  return {
    pieces: system.coins.map((c) => ({ key: c.key, fr: c.label.fr ?? "", en: c.label.en ?? "", valeur: String(c.value_cp), role: c.role })),
    ordre: [...system.break_order],
  };
}

/** Une ligne vide à remplir, en réserve (une pièce courante changerait la monnaie rendue dès sa saisie). */
export function ajouterPiece(b: BrouillonSysteme): BrouillonSysteme {
  return { ...b, pieces: [...b.pieces, { key: "", fr: "", en: "", valeur: "", role: "reserve" }] };
}

/** Les réserves dans l'ordre de casse : celles du brouillon d'abord, puis les nouvelles, dans l'ordre des lignes. */
export function ordreEffectif(b: BrouillonSysteme): string[] {
  const reserves = b.pieces.filter((p) => p.role === "reserve" && p.key !== "").map((p) => p.key);
  return [...b.ordre.filter((k) => reserves.includes(k)), ...reserves.filter((k) => !b.ordre.includes(k))];
}

/** Monte (-1) ou descend (+1) une réserve dans l'ordre de casse. */
export function deplacerDansOrdre(b: BrouillonSysteme, key: string, sens: -1 | 1): BrouillonSysteme {
  const ordre = ordreEffectif(b);
  const i = ordre.indexOf(key);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= ordre.length) return { ...b, ordre };
  [ordre[i], ordre[j]] = [ordre[j]!, ordre[i]!];
  return { ...b, ordre };
}

export function systemeDe(b: BrouillonSysteme): { ok: true; systeme: CurrencySystem } | { ok: false; message: string } {
  const candidat = {
    coins: b.pieces.map((p) => ({ key: p.key.trim(), label: { fr: p.fr.trim(), en: p.en.trim() }, value_cp: /^\d+$/.test(p.valeur.trim()) ? Number(p.valeur.trim()) : Number.NaN, role: p.role })),
    break_order: ordreEffectif(b),
  };
  const r = zCurrencySystemBlockData.safeParse(candidat);
  if (r.success) return { ok: true, systeme: r.data };
  const issue = r.error.issues[0];
  return { ok: false, message: issue ? `${issue.path.join(".") || "système"} : ${issue.message}` : "Système invalide." };
}
