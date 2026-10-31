import { CLASS_PROFICIENCY_LABELS_FR, TOOL_PROFICIENCY_LABELS_FR, WEAPON_ARMOR_PROFICIENCY_LABELS_FR } from "@/src/i18n/fr";

/**
 * V3.1-50 — Les maîtrises d'armure, d'arme et d'outil telles que l'écran les
 * montre : une seule fois chacune, en français, avec toutes ses sources.
 *
 * Le serveur accorde une ligne par source sans jamais les réunir : deux
 * sources qui donnent la même arme (ou deux clés qui se résolvent vers la
 * même fiche) faisaient deux pastilles « Lance ». Et la maîtrise d'outil d'un
 * historique (bloc `background`) arrive avec son nom anglais pour clé,
 * qu'aucune fiche ne traduit.
 */

export interface MaitriseBrute {
  key: string;
  name: string;
  source: string;
}

export interface MaitriseAffichee {
  key: string;
  /** Libellé français. */
  name: string;
  /** Toutes les sources, sans doublon, dans l'ordre d'apparition. */
  sources: string[];
}

/** Le libellé français : le nom s'il l'est déjà (résolu par le serveur), sinon les tables, sinon le nom tel quel. */
export function libelleMaitrise(m: { key: string; name: string }): string {
  const nom = m.name.replace(/^Tool: /, "");
  return (
    CLASS_PROFICIENCY_LABELS_FR[nom] ??
    TOOL_PROFICIENCY_LABELS_FR[nom] ??
    (m.name === m.key ? WEAPON_ARMOR_PROFICIENCY_LABELS_FR[m.key] : undefined) ??
    nom
  );
}

/** Insensible à la casse et aux accents : « Lance » et « lance » sont la même maîtrise. */
function empreinte(libelle: string): string {
  return libelle.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Réunit les maîtrises de même clé, puis de même libellé, en cumulant leurs sources. */
export function dedoublonnerMaitrises(brutes: readonly MaitriseBrute[]): MaitriseAffichee[] {
  const parEmpreinte = new Map<string, MaitriseAffichee>();
  for (const m of brutes) {
    const nom = libelleMaitrise(m);
    const id = empreinte(nom);
    const deja = parEmpreinte.get(id);
    if (!deja) {
      parEmpreinte.set(id, { key: m.key, name: nom, sources: [m.source] });
    } else if (!deja.sources.includes(m.source)) {
      deja.sources.push(m.source);
    }
  }
  return [...parEmpreinte.values()];
}
