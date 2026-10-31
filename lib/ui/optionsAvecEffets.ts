import type { ChoiceFrom, ChoiceOption } from "@/src/core/schemas/rule-blocks/choices";
import { localizedLabel } from "@/src/core/rules/choices";
import { MODIFIER_OP_LABELS_FR, modifierTargetLabel } from "@/src/i18n/fr";
import { ftToM } from "@/src/core/rules/encumbrance";

/**
 * V3.1-50 — Le tableau comparatif d'un choix d'option (lignage, legs,
 * lignage gnomique) : une colonne par option, ce qu'elle donne aux niveaux
 * 1, 3 et 5. Pur : lit seulement la donnée du choix, ne calcule aucun chiffre
 * de règle.
 */

export const NIVEAUX_TABLEAU = [1, 3, 5] as const;
export type NiveauTableau = (typeof NIVEAUX_TABLEAU)[number];

export interface ColonneOption {
  id: string;
  libelle: string;
  /** Pour chaque niveau, ce que l'option apporte à ce niveau (sorts nommés, modificateurs écrits). */
  parNiveau: Record<NiveauTableau, string[]>;
}

/** Le choix est-il un choix d'options qui portent des sorts ou des modificateurs ? Sinon, le sélecteur générique suffit. */
export function estTableauComparatif(from: ChoiceFrom | undefined): from is Extract<ChoiceFrom, { kind: "option" }> {
  return from?.kind === "option" && from.options.some((o) => (o.spells?.length ?? 0) > 0 || (o.modifiers?.length ?? 0) > 0);
}

/** Le palier du tableau qui accueille un niveau de personnage : le plus haut palier atteint (un sort du niveau 2 compte au niveau 1). */
function palier(niveau: number): NiveauTableau {
  let retenu: NiveauTableau = 1;
  for (const n of NIVEAUX_TABLEAU) if (n <= niveau) retenu = n;
  return retenu;
}

export function texteModificateur(m: NonNullable<ChoiceOption["modifiers"]>[number]): string {
  const cible = modifierTargetLabel(m.target);
  // Une vitesse est saisie en pieds dans les règles ; la table la lit en mètres, comme la fiche.
  if (m.op === "add" && m.value !== undefined && m.target.startsWith("speed")) {
    return `${cible} ${m.value >= 0 ? "+" : "−"}${String(ftToM(Math.abs(m.value))).replace(".", ",")} m`;
  }
  if (m.op === "add" && m.value !== undefined) return `${cible} ${m.value >= 0 ? "+" : ""}${m.value}${m.per_level ? " par niveau" : ""}`;
  if (m.op === "set" && m.value !== undefined) return `${cible} = ${m.value}`;
  if ((m.op === "min" || m.op === "max") && m.value !== undefined) return `${cible} : ${MODIFIER_OP_LABELS_FR[m.op].toLowerCase()} ${m.value}`;
  return `${cible} : ${MODIFIER_OP_LABELS_FR[m.op].toLowerCase()}`;
}

export function colonnesComparatives(options: readonly ChoiceOption[], nomSort: (cle: string) => string): ColonneOption[] {
  return options.map((o) => {
    const parNiveau: Record<NiveauTableau, string[]> = { 1: [], 3: [], 5: [] };
    // Les modificateurs sont acquis d'emblée : niveau 1.
    for (const m of o.modifiers ?? []) parNiveau[1].push(texteModificateur(m));
    for (const s of o.spells ?? []) parNiveau[palier(s.at_level ?? 1)].push(nomSort(s.key));
    return { id: o.id, libelle: localizedLabel(o.label, o.id), parNiveau };
  });
}
