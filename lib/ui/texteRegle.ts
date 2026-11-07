import type { Skill } from "@/src/core/rules/sheet";

/**
 * V3.1-173 — De quoi expliquer un choix de l'assistant par la fiche de règle
 * elle-même (le contenu de règles est de la donnée) : la clé de la fiche
 * d'une compétence ou d'une botte, et le texte d'un bloc `description`.
 */

interface BlocFiche {
  blockType: string;
  data: unknown;
}

/** Les fiches `skill-<index>` naissent de l'import du SRD (`ingest-srd --only=Skills`) : l'index a des tirets, la clé du moteur des soulignés. */
export function cleRegleCompetence(skill: Skill): string {
  return `skill-${skill.replaceAll("_", "-")}`;
}

/** Les fiches des bottes d'armes : `weapon-mastery-<clé>` (`nick`, `vex`…). */
export function cleRegleBotte(masteryKey: string): string {
  return `weapon-mastery-${masteryKey}`;
}

/** Le texte du bloc `description` d'une fiche, ses segments bout à bout ; vide s'il n'y en a pas ou s'il est illisible. */
export function texteDescription(blocs: readonly BlocFiche[] | undefined): string {
  const segments = (blocs?.find((b) => b.blockType === "description")?.data as { segments?: unknown } | undefined)?.segments;
  if (!Array.isArray(segments)) return "";
  return segments
    .map((s) => (s && typeof s === "object" && typeof (s as { text?: unknown }).text === "string" ? (s as { text: string }).text : ""))
    .filter((t) => t !== "")
    .join(" ");
}
