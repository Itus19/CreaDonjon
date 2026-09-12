import type { ReactNode } from "react";

/**
 * Quatre marques INLINE reconnues, chacune avec sa propre paire de
 * delimiteurs distincte (retour utilisateur : "les mêmes options que la
 * mise en forme de texte dans les blocs de texte" — DescriptionTextarea.tsx
 * propose desormais Gras/Italique/Souligne/Barre, pas seulement le gras).
 * Toujours un ENSEMBLE FERME de quatre motifs, jamais un parseur markdown
 * complet (CLAUDE.md, aucun interpreteur generaliste pour du texte qui n'en
 * a pas besoin) : ni imbrication de marques, ni echappement, une seule passe
 * de gauche a droite. L'ordre des alternatives compte (`**` doit etre tente
 * avant `*` pour qu'un gras ne soit jamais lu comme deux italiques emboites).
 * Souligne emprunte `__x__` (aucun symbole markdown standard pour ca) :
 * jamais ambigu ici puisque `_` seul n'a aucun sens dans cette grammaire.
 */
const INLINE_MARK_RE = /\*\*([^*]+)\*\*|~~([^~]+)~~|__([^_]+)__|\*([^*]+)\*/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let index = 0;
  INLINE_MARK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_MARK_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [, bold, strike, underline, italic] = match;
    const key = `${keyPrefix}-m${index++}`;
    if (bold !== undefined) nodes.push(<strong key={key}>{bold}</strong>);
    else if (strike !== undefined) nodes.push(<s key={key}>{strike}</s>);
    else if (underline !== undefined) nodes.push(<u key={key}>{underline}</u>);
    else nodes.push(<em key={key}>{italic}</em>);
    lastIndex = INLINE_MARK_RE.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/**
 * "**Titre.**" en debut de paragraphe -> sous-titre sur sa propre ligne,
 * `\n` -> nouveau paragraphe (V1-D7, sur retour utilisateur) : motif
 * constant du texte SRD (dons, traits/actions de monstre, incantation de
 * classe, et la prose generale des descriptions elle-meme) — inchange.
 * Point de rendu unique, partage par ce composant (bloc `description`, ex.
 * la fiche d'un don vue directement) et par `blockContentRenderer.tsx`
 * (traits/actions/incantation, ex. la meme description de don reprise dans
 * le bloc `background` d'un historique) — une seule correction future a
 * faire, jamais deux implementations qui pourraient diverger.
 *
 * Titre sur sa propre ligne (V1-D7, sur retour utilisateur — "**Titre.**
 * texte..." restait sur une seule ligne, hierarchie peu lisible pour un
 * paragraphe a plusieurs sous-points) : quand un paragraphe COMMENCE par
 * "**...**", le titre devient sa propre ligne et le texte qui suit sa
 * propre ligne en dessous, plutot que les deux cote a cote. Le reste du
 * texte (titre inclus) passe par `renderInline` : les trois autres marques
 * (et un gras qui ne serait pas en tete de paragraphe) restent actives
 * partout ailleurs dans le texte.
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
        ...(rest ? [<p key={`${keyPrefix}-${i}-body`}>{renderInline(rest, `${keyPrefix}-${i}-body`)}</p>] : []),
      ];
    }
    return [<p key={`${keyPrefix}-${i}`}>{renderInline(paragraph, `${keyPrefix}-${i}`)}</p>];
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
