import { Node, mergeAttributes } from "@tiptap/core";
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
