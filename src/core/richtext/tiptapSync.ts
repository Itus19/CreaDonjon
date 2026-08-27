import {
  MARKS,
  SEGMENT_ALIGNS,
  type Mark,
  type Segment,
  type SegmentAlign,
  type SegmentBlockType,
  type SegmentContentNode,
} from "../schemas/entities/segments";

/**
 * Conversion pure entre `Segment[]` (SCHEMA.md §6) et la forme JSON d'un
 * document ProseMirror/Tiptap (doc > blocs > noeuds inline). Volontairement
 * independant de `@tiptap/*` (regle absolue n°14 : `src/core` n'importe
 * rien d'une bibliotheque d'interface) — ce module ne connait qu'une forme
 * structurelle minimale, le composant React (`components/entities/...`)
 * fait le pont avec l'instance Tiptap reelle via `editor.getJSON()`.
 *
 * Un segment = un bloc (un paragraphe ou un titre), jamais un fragment
 * inline : la visibilite (SCHEMA.md §7.1) reste a la granularite du bloc,
 * portee par les attributs `visibilityLevel`/`visibilityScopeId` du noeud
 * de bloc plutot que par une marque sur le texte.
 */

export interface InlineNodeJSON {
  type: string;
  text?: string;
  marks?: { type: string }[];
  attrs?: { kind?: string; id?: string; key?: string; label?: string };
}

export interface BlockNodeJSON {
  type: string;
  attrs?: {
    level?: number;
    segmentId?: string;
    visibilityLevel?: string;
    visibilityScopeId?: string | null;
    align?: string;
  };
  content?: InlineNodeJSON[];
}

export interface DocJSON {
  type: "doc";
  content: BlockNodeJSON[];
}

const HEADING_LEVEL_BY_BLOCK_TYPE: Partial<Record<SegmentBlockType, number>> = { h1: 1, h2: 2, h3: 3, h4: 4 };
const BLOCK_TYPE_BY_HEADING_LEVEL: Record<number, SegmentBlockType> = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" };
const VISIBILITY_LEVELS = ["public", "players", "gm", "campaign", "user", "private"] as const;

let idCounter = 0;
function freshSegmentId(): string {
  idCounter += 1;
  return `s${Date.now().toString(36)}${idCounter}`;
}

function isMark(value: string): value is Mark {
  return (MARKS as readonly string[]).includes(value);
}

function isVisibilityLevel(value: string): value is (typeof VISIBILITY_LEVELS)[number] {
  return (VISIBILITY_LEVELS as readonly string[]).includes(value);
}

function isSegmentAlign(value: string): value is SegmentAlign {
  return (SEGMENT_ALIGNS as readonly string[]).includes(value);
}

export function docToSegments(doc: DocJSON): Segment[] {
  const seenIds = new Set<string>();

  return doc.content.map((node): Segment => {
    const blockType: SegmentBlockType =
      node.type === "heading" && node.attrs?.level ? (BLOCK_TYPE_BY_HEADING_LEVEL[node.attrs.level] ?? "paragraph") : "paragraph";

    let id = node.attrs?.segmentId;
    if (!id || seenIds.has(id)) id = freshSegmentId();
    seenIds.add(id);

    const rawLevel = node.attrs?.visibilityLevel;
    const level = rawLevel && isVisibilityLevel(rawLevel) ? rawLevel : "public";
    const scopeId = level === "campaign" || level === "user" ? (node.attrs?.visibilityScopeId ?? null) : null;

    const rawAlign = node.attrs?.align;
    const align: SegmentAlign = rawAlign && isSegmentAlign(rawAlign) ? rawAlign : "left";

    const content: SegmentContentNode[] = (node.content ?? [])
      .map((inline): SegmentContentNode | null => {
        if (inline.type === "text" && inline.text !== undefined) {
          const marks = (inline.marks ?? []).map((m) => m.type).filter(isMark);
          return marks.length > 0 ? { t: "text", v: inline.text, marks } : { t: "text", v: inline.text };
        }
        if (inline.type === "refMention" && inline.attrs) {
          return {
            t: "ref",
            kind: (inline.attrs.kind as "entity" | "rule" | "asset" | undefined) ?? "entity",
            id: inline.attrs.id,
            key: inline.attrs.key,
            label: inline.attrs.label ?? "",
          };
        }
        return null;
      })
      .filter((n): n is SegmentContentNode => n !== null);

    return {
      id,
      blockType,
      visibility: { level, scopeId },
      content: content.length > 0 ? content : [{ t: "text", v: "" }],
      align,
    };
  });
}

export function segmentsToDoc(segments: Segment[]): DocJSON {
  return {
    type: "doc",
    content: segments.map((segment): BlockNodeJSON => {
      const level = HEADING_LEVEL_BY_BLOCK_TYPE[segment.blockType];
      const content = segment.content
        .map((node): InlineNodeJSON | null => {
          if (node.t === "text") {
            if (node.v === "") return null;
            return {
              type: "text",
              text: node.v,
              ...(node.marks && node.marks.length > 0 ? { marks: node.marks.map((m) => ({ type: m })) } : {}),
            };
          }
          return { type: "refMention", attrs: { kind: node.kind, id: node.id, key: node.key, label: node.label } };
        })
        .filter((n): n is InlineNodeJSON => n !== null);

      return {
        type: level ? "heading" : "paragraph",
        attrs: {
          ...(level ? { level } : {}),
          segmentId: segment.id,
          visibilityLevel: segment.visibility.level,
          visibilityScopeId: segment.visibility.scopeId,
          align: segment.align,
        },
        content,
      };
    }),
  };
}
