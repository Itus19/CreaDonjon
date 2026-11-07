import type { ResolvedFeature } from "@/src/core/rules/sheet";
import type { ActivationBlockData } from "@/src/core/schemas/rule-blocks/playable";

/**
 * V3.1-166 (ADR 0076) — lancer un sort par son activation, côté fiche. Pur :
 * ce que la carte d'un sort propose (emplacements, options de lancement).
 * Le serveur revérifie tout (`spell_not_known`, `no_slot_available`,
 * `slot_too_low`, `unknown_cast_option`) ; ces calculs ne servent qu'à offrir
 * les bons choix et à désactiver un bouton quand le refus est certain.
 */

export interface EmplacementOffert {
  niveau: number;
  restants: number;
}

/**
 * Les niveaux d'emplacement qui peuvent payer un sort de niveau de base `base`,
 * encore disponibles : les emplacements ordinaires (total moins dépensés) et la
 * réserve de pacte, qui s'ajoute à son niveau. Un sort mineur (0) n'en demande pas.
 */
export function emplacementsOfferts(p: {
  base: number;
  totaux: Readonly<Record<number, number>>;
  depenses: Readonly<Record<string, number>>;
  pacte: { count: number; slotLevel: number } | null;
  pacteDepense: number;
}): EmplacementOffert[] {
  if (p.base <= 0) return [];
  const parNiveau = new Map<number, number>();
  for (const [niveau, total] of Object.entries(p.totaux)) {
    parNiveau.set(Number(niveau), Math.max(0, total - (p.depenses[niveau] ?? 0)));
  }
  if (p.pacte) {
    parNiveau.set(p.pacte.slotLevel, (parNiveau.get(p.pacte.slotLevel) ?? 0) + Math.max(0, p.pacte.count - p.pacteDepense));
  }
  return [...parNiveau.entries()]
    .filter(([niveau, restants]) => niveau >= p.base && restants > 0)
    .map(([niveau, restants]) => ({ niveau, restants }))
    .sort((a, b) => a.niveau - b.niveau);
}

export interface OptionLancement {
  /** La fiche de règle de l'aptitude qui offre l'option. */
  ruleKey: string;
  optionId: string;
  label: Record<string, string>;
}

/** Les options de lancement que les aptitudes du personnage offrent (Sort accéléré de la Métamagie). */
export function optionsDeLancement(features: readonly Pick<ResolvedFeature, "key" | "activation">[]): OptionLancement[] {
  return features.flatMap((f) =>
    (f.activation?.activations ?? []).flatMap((a) => (a.cast_options ?? []).map((o) => ({ ruleKey: f.key, optionId: o.id, label: o.label })))
  );
}

export interface SortJouable {
  cle: string;
  nom: string;
  bloc: ActivationBlockData;
}

/** Les sorts à montrer, triés par nom ; un sort sans activation visible n'a pas de carte. */
export function sortsJouables(
  blocs: Readonly<Record<string, ActivationBlockData>> | undefined,
  nomDe: (cle: string) => string
): SortJouable[] {
  return Object.entries(blocs ?? {})
    .filter(([, bloc]) => bloc.activations.length > 0)
    .map(([cle, bloc]) => ({ cle, nom: nomDe(cle), bloc }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
}
