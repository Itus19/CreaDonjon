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
 *
 * Titre sur sa propre ligne (V1-D7, sur retour utilisateur — "**Titre.**
 * texte..." restait sur une seule ligne, hierarchie peu lisible pour un
 * paragraphe a plusieurs sous-points) : quand un paragraphe COMMENCE par
 * "**...**" (toujours le cas dans ce motif SRD — jamais un gras en milieu
 * de phrase), le titre devient sa propre ligne et le texte qui suit sa
 * propre ligne en dessous, plutot que les deux cote a cote.
 */
export function renderMarkdownBoldText(text: string, keyPrefix: string): ReactNode[] {
  return text.split("\n").flatMap((paragraph, i) => {
    const leadingBold = paragraph.match(/^\*\*([^*]+)\*\*\s*([\s\S]*)$/);
    if (leadingBold) {
      const [, title, rest] = leadingBold;
      return [
        <p key={`${keyPrefix}-${i}-title`}>
          <strong>{title}</strong>
        </p>,
        ...(rest ? [<p key={`${keyPrefix}-${i}-body`}>{rest}</p>] : []),
      ];
    }
    return [<p key={`${keyPrefix}-${i}`}>{paragraph}</p>];
  });
}

/**
 * Mise en page `prose` (specs/regles-blocs.md §4) : segments narratifs. Une
 * fiche de regle importee n'a que du public — pas de visibilite par segment
 * ici (contrairement au wiki).
 *
 * `pageRef` (V1-D5, specs/ruleset-personnel.md §1) : une reference de page
 * ("Voir MM 2024, p. 232."), jamais du contenu narratif — rendue en dehors
 * du flux de `segments`, visuellement distincte (italique, muette), pour
 * qu'elle ne se confonde jamais avec la prose elle-meme.
 */
export default function Prose({ segments, pageRef }: { segments: { text: string }[]; pageRef?: string }) {
  return (
    <div className="rich-text-content flex flex-col gap-2">
      {segments.flatMap((segment, i) => renderMarkdownBoldText(segment.text, `seg-${i}`))}
      {pageRef && <p className="text-sm italic text-ink-muted">{pageRef}</p>}
    </div>
  );
}
