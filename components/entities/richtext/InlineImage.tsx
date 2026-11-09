"use client";

import { createContext, useContext, type CSSProperties } from "react";
import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import type { ImageBlockData } from "@/src/core/schemas/blocks/image";
import { TAILLE_MAX, TAILLE_MIN, tailleSuivante } from "@/lib/ui/imageBloc";

/**
 * V3.1-189 (option B, ADR 0079) — une image posee DANS la phrase, dans
 * l'editeur du bloc Texte.
 *
 * Le noeud ne porte que `blockId` : c'est la meme forme que le segment
 * stocke (`{ t: "image", blockId }`, `tiptapSync.ts`). L'adresse, la legende,
 * l'habillage et la taille vivent sur le bloc image, lus ici par un contexte
 * React (les vues de noeud de Tiptap sont rendues en portail, elles voient le
 * contexte de l'editeur) ; la bulle les modifie sur ce bloc, jamais dans le
 * texte.
 *
 * `draggable` : on saisit l'image et on la depose ailleurs dans le texte, au
 * milieu d'une phrase si l'on veut — ProseMirror deplace le noeud, le texte
 * se reecrit autour. Entre deux blocs Texte de la meme fiche aussi : le
 * glisser passe par le HTML (`parseHTML` ci-dessous).
 */

export interface InlineImagesValue {
  /** Les blocs image de la fiche, par identifiant. Une image absente (supprimee, ou que ce compte ne voit pas) ne se dessine pas, mais son noeud est garde. */
  images: Record<string, ImageBlockData>;
  /** Ecrit de nouveaux reglages sur le bloc image. Absent : bulle en lecture seule. */
  onEditImage?: (blockId: string, data: ImageBlockData) => void;
}

const InlineImagesContext = createContext<InlineImagesValue>({ images: {} });
export const InlineImagesProvider = InlineImagesContext.Provider;

/** Meme largeur de reference que le rendu public (`PublicInlineImage`), pour que l'editeur montre la taille reelle. */
const BASE_IMAGE_WIDTH_PX = 480;

function InlineImageView({ node, selected }: NodeViewProps) {
  const { images } = useContext(InlineImagesContext);
  const blockId = node.attrs.blockId as string | null;
  const data = blockId ? images[blockId] : undefined;
  if (!data?.url) {
    // Rien a montrer, mais le noeud reste : le supprimer ici effacerait la
    // place de l'image a la prochaine sauvegarde, sans que personne l'ait
    // demande.
    return <NodeViewWrapper as="span" className="inline-image-absente" data-inline-image="" />;
  }
  const widthPx = (BASE_IMAGE_WIDTH_PX * data.sizePct) / 100;
  const placement =
    data.anchorFlow === "break"
      ? `my-3 flex ${data.align === "left" ? "mr-auto" : data.align === "right" ? "ml-auto" : "mx-auto"}`
      : `mb-3 mt-1 ${data.align === "left" ? "float-left mr-4" : "float-right ml-4"}`;
  return (
    <NodeViewWrapper
      as="span"
      data-inline-image=""
      data-drag-handle=""
      className={`inline-image flex w-[var(--img-w)] max-w-full cursor-grab flex-col gap-1 ${placement} ${selected ? "outline outline-2 outline-offset-2 outline-accent" : ""} rounded-md`}
      style={{ "--img-w": `${widthPx}px` } as CSSProperties & Record<`--${string}`, string>}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.url} alt={data.caption} draggable={false} className="block w-full rounded-md object-cover" />
      {data.caption && <span className="block text-xs italic text-ink-muted">{data.caption}</span>}
    </NodeViewWrapper>
  );
}

export const InlineImage = Node.create({
  name: "inlineImage",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-image-block-id"),
        renderHTML: (attrs: { blockId?: string | null }) => (attrs.blockId ? { "data-image-block-id": attrs.blockId } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-inline-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-inline-image": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineImageView, { as: "span" });
  },
});

/** L'image actuellement selectionnee dans l'editeur, ou `null`. */
export function selectedInlineImageId(editor: Editor): string | null {
  if (!editor.isActive("inlineImage")) return null;
  return (editor.getAttributes("inlineImage").blockId as string | null) ?? null;
}

const HABILLAGES = [
  { cle: "gauche", label: "Texte autour, image à gauche", flow: "float", align: "left" },
  { cle: "droite", label: "Texte autour, image à droite", flow: "float", align: "right" },
  { cle: "hautBas", label: "Haut et bas : l'image coupe le texte", flow: "break", align: null },
] as const;

const ALIGNEMENTS_HAUT_BAS = [
  { align: "left", label: "À gauche" },
  { align: "center", label: "Au centre" },
  { align: "right", label: "À droite" },
] as const;

function IconeHabillage({ cle }: { cle: (typeof HABILLAGES)[number]["cle"] }) {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {cle === "gauche" && (
        <>
          <rect x="1" y="2" width="7" height="7" rx="1" />
          <path d="M11 3h6M11 6h6M11 9h6M1 13h16" />
        </>
      )}
      {cle === "droite" && (
        <>
          <rect x="10" y="2" width="7" height="7" rx="1" />
          <path d="M1 3h6M1 6h6M1 9h6M1 13h16" />
        </>
      )}
      {cle === "hautBas" && (
        <>
          <path d="M1 2h16" />
          <rect x="5" y="5" width="8" height="6" rx="1" />
          <path d="M1 14h16" />
        </>
      )}
    </svg>
  );
}

const BOUTON = "rounded px-2 py-1 text-xs transition-colors hover:bg-panel";

/**
 * Le contenu de la bulle quand une image est selectionnee — meme cadre que la
 * bulle de mise en forme (`RichTextEditor`), qui la montre a la place des
 * boutons de texte.
 */
export function InlineImageBubble({
  editor,
  blockId,
  showMoveButtons,
  onOpenImageBlock,
}: {
  editor: Editor;
  blockId: string;
  /** Telephone : pas de glisser au doigt dans un texte qui defile, « Monter » / « Descendre » d'un paragraphe a la place. */
  showMoveButtons: boolean;
  /** Fait defiler jusqu'au bloc image (legende, parallaxe, fond de page). */
  onOpenImageBlock?: (blockId: string) => void;
}) {
  const { images, onEditImage } = useContext(InlineImagesContext);
  const data = images[blockId];

  function ecrire(patch: Partial<ImageBlockData>) {
    if (!data || !onEditImage) return;
    onEditImage(blockId, { ...data, ...patch });
  }

  function retirer() {
    editor.chain().focus().deleteSelection().run();
  }

  /** Deplace l'image en tete du paragraphe precedent ou suivant. */
  function deplacer(sens: -1 | 1) {
    const { state } = editor;
    const from = state.selection.from;
    const $pos = state.doc.resolve(from);
    const indexBloc = $pos.index(0);
    const cible = indexBloc + sens;
    if (cible < 0 || cible >= state.doc.childCount) return;
    const noeud = state.doc.nodeAt(from);
    if (!noeud) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.delete(from, from + noeud.nodeSize);
        // Position du debut du paragraphe vise, recalculee apres la suppression.
        let pos = 0;
        for (let k = 0; k < cible; k++) pos += tr.doc.child(k).nodeSize;
        const bloc = tr.doc.child(cible);
        if (!bloc.isTextblock) return false;
        tr.insert(pos + 1, noeud);
        return true;
      })
      .run();
  }

  const actif = data ? (data.anchorFlow === "break" ? "hautBas" : data.align === "left" ? "gauche" : "droite") : null;

  return (
    <>
      {HABILLAGES.map((h) => (
        <button
          key={h.cle}
          type="button"
          onClick={() => ecrire(h.flow === "break" ? { anchorFlow: "break" } : { anchorFlow: "float", align: h.align })}
          disabled={!onEditImage}
          aria-label={h.label}
          title={h.label}
          aria-pressed={actif === h.cle}
          className={`flex items-center justify-center rounded px-1.5 py-1 transition-colors hover:bg-panel ${actif === h.cle ? "bg-panel text-accent" : "text-ink"}`}
        >
          <IconeHabillage cle={h.cle} />
        </button>
      ))}
      {actif === "hautBas" &&
        ALIGNEMENTS_HAUT_BAS.map((a) => (
          <button
            key={a.align}
            type="button"
            onClick={() => ecrire({ align: a.align })}
            aria-pressed={data?.align === a.align}
            className={`${BOUTON} ${data?.align === a.align ? "bg-panel text-accent" : "text-ink"}`}
          >
            {a.label}
          </button>
        ))}
      <span className="mx-0.5 h-4 w-px bg-edge" />
      <button type="button" onClick={() => data && ecrire({ sizePct: tailleSuivante(data.sizePct, -1) })} disabled={!data || data.sizePct <= TAILLE_MIN} aria-label="Plus petite" className={`${BOUTON} text-ink disabled:opacity-40`}>
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-xs text-ink">{data ? `${data.sizePct} %` : "—"}</span>
      <button type="button" onClick={() => data && ecrire({ sizePct: tailleSuivante(data.sizePct, 1) })} disabled={!data || data.sizePct >= TAILLE_MAX} aria-label="Plus grande" className={`${BOUTON} text-ink disabled:opacity-40`}>
        +
      </button>
      {showMoveButtons && (
        <>
          <span className="mx-0.5 h-4 w-px bg-edge" />
          <button type="button" onClick={() => deplacer(-1)} aria-label="Monter l'image d'un paragraphe" className={`${BOUTON} text-ink`}>
            ▲
          </button>
          <button type="button" onClick={() => deplacer(1)} aria-label="Descendre l'image d'un paragraphe" className={`${BOUTON} text-ink`}>
            ▼
          </button>
        </>
      )}
      <span className="mx-0.5 h-4 w-px bg-edge" />
      {onOpenImageBlock && (
        <button type="button" onClick={() => onOpenImageBlock(blockId)} className={`${BOUTON} text-ink`}>
          Bloc image
        </button>
      )}
      <button type="button" onClick={retirer} className={`${BOUTON} text-danger`}>
        Retirer du texte
      </button>
    </>
  );
}
