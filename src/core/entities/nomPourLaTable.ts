/**
 * AG-12 (ADR 0105) — « Nom pour la table » : une fiche que la table connaît
 * sans connaître son vrai nom. Le nom ordinaire de la fiche
 * (`entities.name`, lisible par tout membre) devient le nom pour la table ;
 * le vrai nom et ses alias vont dans `entity_true_names`, lisible par le MJ
 * seul. Vider le champ révèle le vrai nom.
 */
export interface Identite {
  name: string;
  aliases: string[];
}

export interface NomSecret {
  trueName: string;
  trueAliases: string[];
}

export type PlanNomTable =
  | { kind: "aucun" }
  | { kind: "activer"; entite: Identite; secret: NomSecret; anciens: string[]; nouveau: string }
  | { kind: "changer"; entite: Identite; anciens: string[]; nouveau: string }
  | { kind: "reveler"; entite: Identite; anciens: string[]; nouveau: string };

/**
 * Ce qu'il faut écrire quand le MJ saisit `nomTable` (vide ou `null` :
 * révéler). `anciens` et `nouveau` disent quels textes de lien renommer
 * (`renommerRefs`).
 */
export function planNomTable(actuel: Identite, secret: NomSecret | null, nomTable: string | null): PlanNomTable {
  const saisi = nomTable?.trim() ?? "";
  if (secret === null) {
    if (saisi === "" || saisi === actuel.name) return { kind: "aucun" };
    return {
      kind: "activer",
      entite: { name: saisi, aliases: [] },
      secret: { trueName: actuel.name, trueAliases: [...actuel.aliases] },
      anciens: [actuel.name, ...actuel.aliases],
      nouveau: saisi,
    };
  }
  if (saisi === "" || saisi === secret.trueName) {
    return {
      kind: "reveler",
      entite: { name: secret.trueName, aliases: [...new Set([...secret.trueAliases, ...actuel.aliases])] },
      anciens: [actuel.name],
      nouveau: secret.trueName,
    };
  }
  if (saisi === actuel.name) return { kind: "aucun" };
  return { kind: "changer", entite: { name: saisi, aliases: [...actuel.aliases] }, anciens: [actuel.name], nouveau: saisi };
}
