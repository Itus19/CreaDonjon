import type { ReactNode } from "react";

/**
 * "**Titre.**" -> gras reel, `\n` -> nouveau paragraphe (V1-D7, sur retour
 * utilisateur) : motif constant du texte SRD (dons, traits/actions de
 * monstre, incantation de classe, et la prose generale des descriptions
 * elle-meme). Point de rendu unique, partage par ce composant (bloc
 * `description`, ex. la fiche d'un don vue directement) et par
 * `blockContentRenderer.tsx` (traits/actions/incantation, ex. la meme
 * description de don reprise dans le bloc `background` d'un historique) —
 * une seule correction future a faire, jamais deux implementations qui
 * pourraient diverger. Jamais un parseur markdown complet (CLAUDE.md,
 * aucun interpreteur generaliste pour du texte qui n'en a pas besoin) : un
 * seul motif reconnu, celui que le SRD utilise reellement ici.
 */
export function renderMarkdownBoldText(text: string, keyPrefix: string): ReactNode[] {
  return text.split("\n").map((paragraph, i) => (
    <p key={`${keyPrefix}-${i}`}>
      {paragraph.split(/(\*\*[^*]+\*\*)/g).map((chunk, j) =>
        chunk.startsWith("**") && chunk.endsWith("**") ? <strong key={j}>{chunk.slice(2, -2)}</strong> : chunk
      )}
    </p>
  ));
}

/** Mise en page `prose` (specs/regles-blocs.md §4) : segments narratifs. Une fiche de regle importee n'a que du public — pas de visibilite par segment ici (contrairement au wiki). */
export default function Prose({ segments }: { segments: { text: string }[] }) {
  return (
    <div className="rich-text-content flex flex-col gap-2">
      {segments.flatMap((segment, i) => renderMarkdownBoldText(segment.text, `seg-${i}`))}
    </div>
  );
}
