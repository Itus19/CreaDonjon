import { Mark, Node, mergeAttributes } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";

/**
 * Chaque bloc Tiptap (paragraphe ou titre) porte l'identite et la
 * visibilite de son segment (SCHEMA.md §6/§7.1) comme attributs — rendus en
 * `data-*` pour permettre l'indicateur visuel CSS (globals.css) sans
 * dupliquer l'information ailleurs. `src/core/richtext/tiptapSync.ts` lit
 * ces memes attributs pour reconstruire les segments a la sauvegarde.
 */
const segmentAttributes = {
  segmentId: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-segment-id"),
    renderHTML: (attrs: { segmentId?: string | null }) =>
      attrs.segmentId ? { "data-segment-id": attrs.segmentId } : {},
  },
  visibilityLevel: {
    default: "public",
    parseHTML: (element: HTMLElement) => element.getAttribute("data-visibility") ?? "public",
    renderHTML: (attrs: { visibilityLevel?: string }) => ({
      "data-visibility": attrs.visibilityLevel ?? "public",
    }),
  },
  visibilityScopeId: {
    default: null as string | null,
    parseHTML: (element: HTMLElement) => element.getAttribute("data-visibility-scope"),
    renderHTML: (attrs: { visibilityScopeId?: string | null }) =>
      attrs.visibilityScopeId ? { "data-visibility-scope": attrs.visibilityScopeId } : {},
  },
  // Alignement (V2-G14, retour utilisateur — bulle de mise en forme) :
  // meme mecanique que visibilityLevel ci-dessus, jamais une marque sur le
  // contenu (un mot aligne differemment du reste de son paragraphe n'existe
  // pas dans un traitement de texte).
  align: {
    default: "left",
    parseHTML: (element: HTMLElement) => element.getAttribute("data-align") ?? "left",
    renderHTML: (attrs: { align?: string }) => ({ "data-align": attrs.align ?? "left" }),
  },
};

export const SegmentParagraph = Paragraph.extend({
  addAttributes() {
    return segmentAttributes;
  },
});

export const SegmentHeading = Heading.configure({ levels: [1, 2, 3, 4] }).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      ...segmentAttributes,
    };
  },
});

/**
 * Mention d'entite/regle dans le texte (noeud `ref`, specs/wiki-liens-et-
 * personnages.md §A1) : un jeton atomique et non editable, jamais du texte
 * libre — coherent avec `src/core/linker` qui detecte ces references en
 * amont, pas dans l'editeur (branchement differe, docs/BACKLOG.md V0-05).
 */
export const RefMention = Node.create({
  name: "refMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      kind: {
        default: "entity",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-kind") ?? "entity",
        renderHTML: (attrs: { kind?: string }) => ({ "data-kind": attrs.kind ?? "entity" }),
      },
      id: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-ref-id"),
        renderHTML: (attrs: { id?: string | null }) => (attrs.id ? { "data-ref-id": attrs.id } : {}),
      },
      key: {
        default: null as string | null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-ref-key"),
        renderHTML: (attrs: { key?: string | null }) => (attrs.key ? { "data-ref-key": attrs.key } : {}),
      },
      label: {
        default: "",
        parseHTML: (element: HTMLElement) => element.textContent ?? "",
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-ref-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-ref-mention": "", class: "rich-ref-mention" }),
      node.attrs.label as string,
    ];
  },
});

/**
 * Marque « spoiler » : caviarde un passage a l'affichage, revele au clic.
 * A ne jamais confondre avec la visibilite (SCHEMA.md §7.1, `Segment.
 * visibility`) — le texte caviarde part quand meme au client (celui qui
 * le lit y a deja droit), seul l'AFFICHAGE initial le cache. Le clic
 * bascule un attribut DOM local (`data-revealed`), jamais une transaction
 * ProseMirror : reveler n'est pas une modification du document, ca ne doit
 * ni se sauvegarder ni survivre a un rechargement.
 */
export const Spoiler = Mark.create({
  name: "spoiler",
  parseHTML() {
    return [{ tag: "span[data-spoiler]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-spoiler": "" }), 0];
  },
});
