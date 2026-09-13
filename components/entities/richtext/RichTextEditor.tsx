"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import BubbleSelect from "./BubbleSelect";
import RefLinkPopover, { type RefLinkTarget } from "./RefLinkPopover";
import { SegmentParagraph, SegmentHeading, RefMention, Spoiler } from "./extensions";
import { VISIBILITY_OPTIONS } from "@/components/shared/visibilityOptions";
import { docToSegments, segmentsToDoc, type DocJSON } from "@/src/core/richtext/tiptapSync";
import type { Segment } from "@/src/core/schemas/entities/segments";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { useDesktop } from "@/components/shell/DesktopContext";
import { windowHref, type WindowRef } from "@/components/shell/windowRefs";
import { useWorldRuleEntries } from "@/components/blocks/useWorldRuleEntries";
import { detectEntityReferences, type LinkableEntity } from "@/src/core/linker/detect";

/** V2.1-1, détection automatique — une mention trouvée dans le texte, pas encore liée, en attente de confirmation (jamais appliquée seule, spec §A1 "Renommage"). */
interface DetectedSuggestion {
  segmentId: string;
  start: number;
  end: number;
  matchedText: string;
  targetName: string;
  target: RefLinkTarget;
}

const BLOCK_TYPE_OPTIONS = [
  { value: "paragraph", label: "Paragraphe" },
  { value: "h1", label: "Titre 1" },
  { value: "h2", label: "Titre 2" },
  { value: "h3", label: "Titre 3" },
  { value: "h4", label: "Titre 4" },
];

const ALIGN_OPTIONS: { value: string; label: string }[] = [
  { value: "left", label: "Aligner à gauche" },
  { value: "center", label: "Centrer" },
  { value: "right", label: "Aligner à droite" },
  { value: "justify", label: "Justifier" },
];

/**
 * Icone "lignes de texte" classique (retour utilisateur : les lettres G/C/D/J
 * ne sont pas reconnaissables, l'utilisateur veut le pictogramme qu'on
 * retrouve dans tout traitement de texte). Quatre barres — pas une police
 * d'icones, juste des `<rect>` positionnes selon l'alignement represente :
 * calees a gauche/au centre/a droite pour left/center/right, toutes pleine
 * largeur pour justify.
 */
function AlignIcon({ value }: { value: string }) {
  const widths = [16, 10, 16, 7];
  return (
    <svg viewBox="0 0 18 14" width="14" height="14" aria-hidden="true">
      {widths.map((w, i) => {
        const width = value === "justify" ? 16 : w;
        const x = value === "center" ? (18 - width) / 2 : value === "right" ? 17 - width : 1;
        return <rect key={i} x={x} y={i * 4 + 0.5} width={width} height={1.6} rx={0.8} fill="currentColor" />;
      })}
    </svg>
  );
}

/**
 * Remplace `SegmentsEditor.tsx` (V0-06f) : une seule zone de texte
 * editable, plus de bouton « + Ajouter un segment ». Les segments existent
 * toujours en interne (un segment = un bloc, paragraphe ou titre — voir
 * `src/core/richtext/tiptapSync.ts`), mais l'auteur ne les manipule jamais
 * directement. La visibilite d'un passage se choisit dans la bulle
 * (« Cacher ce passage ») en s'appliquant aux blocs touches par la
 * selection ; elle reste filtree reellement cote serveur, jamais cachee
 * par CSS (contrairement au marquage cosmetique de l'ancienne application,
 * cf. docs/BACKLOG.md V0-06f).
 */
export default function RichTextEditor({
  segments,
  onChange,
  onBlur,
  worldSlug,
  worldId,
  otherEntities,
}: {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
  onBlur?: () => void;
  /** V2.1-1 : boutons Lier/Créer/Ouvrir masqués sans ces props (ex. description de règle, contexte hors fiche de monde) — même repli que `onLaunchWizard`. */
  worldSlug?: string;
  /** V2.1-1, "Créer comme Fiche" : `POST /api/entities` veut l'id du monde, pas son slug. */
  worldId?: string;
  otherEntities?: OtherEntityOption[];
}) {
  const [initialDoc] = useState<DocJSON>(() => segmentsToDoc(segments));
  const [, forceUpdate] = useState(0);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [showDetect, setShowDetect] = useState(false);
  const [suggestions, setSuggestions] = useState<DetectedSuggestion[]>([]);
  const [hasDetected, setHasDetected] = useState(false);
  const desktop = useDesktop();
  const router = useRouter();
  const ruleEntries = useWorldRuleEntries(worldSlug ?? "");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ paragraph: false, heading: false }),
      SegmentParagraph,
      SegmentHeading,
      RefMention,
      Underline,
      Spoiler,
    ],
    content: initialDoc as unknown as Record<string, unknown>,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "rich-text-content focus:outline-none" },
      // Reveler un spoiler est un bascule d'affichage purement local (voir
      // le commentaire de l'extension Spoiler) : on mute l'attribut DOM
      // directement plutot que de passer par une commande d'edition, pour
      // ne jamais declencher onUpdate ni sauvegarder cet etat ephemere.
      handleClick: (_view, _pos, event) => {
        const target = (event.target as HTMLElement).closest("[data-spoiler]");
        if (!target) return false;
        const revealed = target.getAttribute("data-revealed") === "true";
        target.setAttribute("data-revealed", String(!revealed));
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(docToSegments(editor.getJSON() as DocJSON));
    },
    onSelectionUpdate: () => forceUpdate((n) => n + 1),
    onBlur: () => onBlur?.(),
  });

  if (!editor) return null;

  const currentBlockType = ([1, 2, 3, 4] as const).reduce<string>(
    (acc, level) => (editor.isActive("heading", { level }) ? `h${level}` : acc),
    "paragraph"
  );

  function setBlockType(value: string) {
    if (value === "paragraph") {
      editor?.chain().focus().setParagraph().run();
    } else {
      const level = Number(value.slice(1)) as 1 | 2 | 3 | 4;
      editor?.chain().focus().setHeading({ level }).run();
    }
  }

  const currentVisibility =
    (editor.getAttributes("paragraph").visibilityLevel as string | undefined) ??
    (editor.getAttributes("heading").visibilityLevel as string | undefined) ??
    "public";

  function setVisibilityForSelection(level: string) {
    const { from, to } = editor!.state.selection;
    editor!
      .chain()
      .focus()
      .command(({ tr, state }) => {
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === "paragraph" || node.type.name === "heading") {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, visibilityLevel: level, visibilityScopeId: null });
          }
        });
        return true;
      })
      .run();
  }

  const currentAlign =
    (editor.getAttributes("paragraph").align as string | undefined) ??
    (editor.getAttributes("heading").align as string | undefined) ??
    "left";

  /** Meme patron que setVisibilityForSelection ci-dessus (V2-G14, retour utilisateur) : un attribut de bloc, jamais une marque sur le contenu. */
  function setAlignForSelection(align: string) {
    const { from, to } = editor!.state.selection;
    editor!
      .chain()
      .focus()
      .command(({ tr, state }) => {
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name === "paragraph" || node.type.name === "heading") {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, align });
          }
        });
        return true;
      })
      .run();
  }

  /**
   * V2.1-1 (retour utilisateur) : lie/delie une reference vers une fiche ou
   * une entree de regle. Le noeud `refMention` est atomique (extensions.ts) —
   * lier une selection la REMPLACE par un noeud dont le `label` reste le
   * texte selectionne (jamais le nom de la cible : le label est ce que
   * l'auteur a ecrit, specs/wiki-liens-et-personnages.md §A1). Delier fait
   * l'inverse a partir de ce meme label, aucune perte d'information.
   */
  const selection = editor.state.selection;
  const isRefSelected = selection instanceof NodeSelection && selection.node.type.name === "refMention";
  const hasTextSelection = !selection.empty && !isRefSelected;
  /** V2.1-1, liens brises (specs/wiki-liens-et-personnages.md §A1) : une fiche liee peut avoir ete supprimee entre-temps — jamais verifie pour les regles (leur cle reste valide tant que la regle existe, hors perimetre de ce controle rapide). */
  const selectedRefBroken =
    isRefSelected &&
    (selection as NodeSelection).node.attrs.kind === "entity" &&
    !entitySlugById((selection as NodeSelection).node.attrs.id as string | null);

  function linkSelectionTo(target: RefLinkTarget) {
    const { from, to } = editor!.state.selection;
    const label = editor!.state.doc.textBetween(from, to);
    editor!
      .chain()
      .focus()
      .command(({ tr, state }) => {
        tr.replaceRangeWith(
          from,
          to,
          state.schema.nodes.refMention.create({
            kind: target.kind,
            id: target.kind === "entity" ? target.id : null,
            key: target.kind === "rule" ? target.key : null,
            label,
          })
        );
        return true;
      })
      .run();
  }

  async function createAndLinkSelection() {
    if (!worldId) return;
    const { from, to } = editor!.state.selection;
    const label = editor!.state.doc.textBetween(from, to);
    if (!label.trim()) return;
    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldId, name: label.trim(), entityKind: "other" }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as { id: string };
    linkSelectionTo({ kind: "entity", id: created.id, name: label.trim() });
  }

  function unlinkRefMention() {
    if (!isRefSelected) return;
    const node = (selection as NodeSelection).node;
    const label = node.attrs.label as string;
    editor!
      .chain()
      .focus()
      .command(({ tr, state }) => {
        tr.replaceRangeWith(selection.from, selection.to, state.schema.text(label || " "));
        return true;
      })
      .run();
  }

  function openRefMention() {
    if (!isRefSelected || !worldSlug) return;
    const node = (selection as NodeSelection).node;
    const kind = (node.attrs.kind as string) === "rule" ? "rule" : "entity";
    const key = kind === "rule" ? (node.attrs.key as string | null) : entitySlugById(node.attrs.id as string | null);
    if (!key) return;
    const ref: WindowRef = kind === "rule" ? { kind: "rule", key } : { kind: "entity", key };
    if (desktop) desktop.openRef(ref);
    else router.push(windowHref(worldSlug, ref));
  }

  function entitySlugById(id: string | null): string | null {
    if (!id) return null;
    return otherEntities?.find((e) => e.id === id)?.slug ?? null;
  }

  /**
   * V2.1-1, détection automatique — passe le texte de chaque segment par
   * `detectEntityReferences` (correspondance exacte de nom/alias, deja
   * ecrite et testee) contre les fiches ET les entrees de regle du monde,
   * puis propose les mentions trouvees comme SUGGESTIONS a confirmer —
   * jamais une reecriture silencieuse (specs/wiki-liens-et-personnages.md
   * §A1). Le texte compare inclut le `label` des `ref` deja poses (pour ne
   * pas casser les decalages de caracteres des autres noeuds), filtres
   * ensuite via `existingRanges` pour ne jamais re-suggerer un lien deja
   * present. Un alias partage par plusieurs candidats (`ref.candidates.
   * length > 1`) est ignore plutot que resolu au hasard — meme discipline
   * que `detectEntityReferences` elle-meme.
   */
  function detectLinks() {
    if (!otherEntities) return;
    const candidates: LinkableEntity[] = [
      ...otherEntities.map((e) => ({ id: `entity:${e.id}`, name: e.name, aliases: e.aliases ?? [] })),
      ...ruleEntries.map((r) => ({ id: `rule:${r.key}`, name: r.name, aliases: [] as string[] })),
    ];

    const found: DetectedSuggestion[] = [];
    for (const segment of segments) {
      let text = "";
      const existingRanges: { start: number; end: number }[] = [];
      for (const node of segment.content) {
        if (node.t === "text") {
          text += node.v;
        } else {
          const start = text.length;
          text += node.label;
          existingRanges.push({ start, end: text.length });
        }
      }
      if (text.trim().length === 0) continue;

      for (const ref of detectEntityReferences(text, candidates)) {
        if (ref.candidates.length !== 1) continue;
        if (existingRanges.some((r) => ref.start < r.end && ref.end > r.start)) continue;
        const [kindPrefix, ...rest] = ref.candidates[0].entityId.split(":");
        const rawId = rest.join(":");
        const target: RefLinkTarget =
          kindPrefix === "entity" ? { kind: "entity", id: rawId, name: ref.candidates[0].term } : { kind: "rule", key: rawId, name: ref.candidates[0].term };
        const targetName =
          kindPrefix === "entity"
            ? (otherEntities.find((e) => e.id === rawId)?.name ?? ref.candidates[0].term)
            : (ruleEntries.find((r) => r.key === rawId)?.name ?? ref.candidates[0].term);
        found.push({ segmentId: segment.id, start: ref.start, end: ref.end, matchedText: ref.matchedText, targetName, target });
      }
    }
    setSuggestions(found);
    setHasDetected(true);
  }

  /**
   * Convertit un decalage de caracteres dans le TEXTE D'AFFICHAGE d'un
   * segment (celui compare par `detectEntityReferences` : un noeud `ref`
   * y compte pour la longueur de son `label`) en position ProseMirror
   * reelle — un noeud `refMention` est atomique et n'occupe qu'UNE seule
   * position, quelle que soit la longueur de son label, d'ou les deux
   * compteurs distincts (`display`/`pm`) parcourus en parallele.
   */
  function segmentOffsetToPos(segmentId: string, charOffset: number): number | null {
    let result: number | null = null;
    editor!.state.doc.descendants((node, pos) => {
      if (result !== null) return false;
      if (node.attrs?.segmentId !== segmentId) return true;
      let display = 0;
      let pmOffset = 0;
      node.forEach((child) => {
        if (result !== null) return;
        const isRef = child.type.name === "refMention";
        const childDisplayLen = isRef ? ((child.attrs.label as string) ?? "").length : (child.text?.length ?? 0);
        if (charOffset <= display + childDisplayLen) {
          result = pos + 1 + pmOffset + (isRef ? (charOffset === display ? 0 : child.nodeSize) : charOffset - display);
        }
        display += childDisplayLen;
        pmOffset += child.nodeSize;
      });
      if (result === null && charOffset === display) result = pos + 1 + pmOffset;
      return false;
    });
    return result;
  }

  function applySuggestion(s: DetectedSuggestion) {
    const from = segmentOffsetToPos(s.segmentId, s.start);
    const to = segmentOffsetToPos(s.segmentId, s.end);
    if (from === null || to === null) return;
    const label = editor!.state.doc.textBetween(from, to);
    editor!
      .chain()
      .focus()
      .command(({ tr, state }) => {
        tr.replaceRangeWith(
          from,
          to,
          state.schema.nodes.refMention.create({
            kind: s.target.kind,
            id: s.target.kind === "entity" ? s.target.id : undefined,
            key: s.target.kind === "rule" ? s.target.key : undefined,
            label,
          })
        );
        return true;
      })
      .run();
    setSuggestions((prev) => prev.filter((x) => x !== s));
  }

  function dismissSuggestion(s: DetectedSuggestion) {
    setSuggestions((prev) => prev.filter((x) => x !== s));
  }

  return (
    <div className="flex flex-col gap-1">
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-0.5 rounded-lg border border-edge-strong bg-panel-raised px-1.5 py-1 shadow-2xl"
      >
        {worldSlug && otherEntities && isRefSelected && (
          <>
            {selectedRefBroken ? (
              <span className="rounded px-2 py-1 text-xs text-danger" title="La fiche liée n'existe plus">
                Lien brisé
              </span>
            ) : (
              <button
                type="button"
                onClick={openRefMention}
                aria-label="Ouvrir la fiche liée"
                title="Ouvrir la fiche liée"
                className="rounded px-2 py-1 text-xs text-ink transition-colors hover:bg-panel"
              >
                Ouvrir
              </button>
            )}
            <button
              type="button"
              onClick={unlinkRefMention}
              aria-label="Délier"
              title="Délier"
              className="rounded px-2 py-1 text-xs text-ink transition-colors hover:bg-panel"
            >
              Délier
            </button>
            <span className="mx-0.5 h-4 w-px bg-edge" />
          </>
        )}
        {worldSlug && otherEntities && hasTextSelection && (
          <>
            <span className="relative">
              <button
                type="button"
                onClick={() => setLinkPopoverOpen((v) => !v)}
                aria-label="Lier à la fiche"
                title="Lier à la fiche"
                aria-expanded={linkPopoverOpen}
                className={`rounded px-2 py-1 text-xs transition-colors hover:bg-panel ${linkPopoverOpen ? "bg-panel text-accent" : "text-ink"}`}
              >
                Lier à la Fiche
              </button>
              {linkPopoverOpen && (
                <RefLinkPopover
                  worldSlug={worldSlug}
                  otherEntities={otherEntities}
                  onSelect={(target) => {
                    linkSelectionTo(target);
                    setLinkPopoverOpen(false);
                  }}
                  onClose={() => setLinkPopoverOpen(false)}
                />
              )}
            </span>
            {worldId && (
              <button
                type="button"
                onClick={createAndLinkSelection}
                aria-label="Créer comme fiche"
                title="Créer une nouvelle fiche à partir de la sélection"
                className="rounded px-2 py-1 text-xs text-ink transition-colors hover:bg-panel"
              >
                Créer comme Fiche
              </button>
            )}
            <span className="mx-0.5 h-4 w-px bg-edge" />
          </>
        )}
        <BubbleSelect value={currentBlockType} options={BLOCK_TYPE_OPTIONS} onChange={setBlockType} aria-label="Type de texte" />
        <span className="mx-0.5 h-4 w-px bg-edge" />
        {ALIGN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setAlignForSelection(opt.value)}
            aria-label={opt.label}
            title={opt.label}
            aria-pressed={currentAlign === opt.value}
            className={`flex items-center justify-center rounded px-1.5 py-1 transition-colors hover:bg-panel ${currentAlign === opt.value ? "bg-panel text-accent" : "text-ink"}`}
          >
            <AlignIcon value={opt.value} />
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px bg-edge" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Gras"
          aria-pressed={editor.isActive("bold")}
          className={`rounded px-2 py-1 text-xs font-bold transition-colors hover:bg-panel ${editor.isActive("bold") ? "bg-panel text-accent" : "text-ink"}`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italique"
          aria-pressed={editor.isActive("italic")}
          className={`rounded px-2 py-1 text-xs italic transition-colors hover:bg-panel ${editor.isActive("italic") ? "bg-panel text-accent" : "text-ink"}`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Souligné"
          aria-pressed={editor.isActive("underline")}
          className={`rounded px-2 py-1 text-xs underline transition-colors hover:bg-panel ${editor.isActive("underline") ? "bg-panel text-accent" : "text-ink"}`}
        >
          U
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-label="Barré"
          aria-pressed={editor.isActive("strike")}
          className={`rounded px-2 py-1 text-xs line-through transition-colors hover:bg-panel ${editor.isActive("strike") ? "bg-panel text-accent" : "text-ink"}`}
        >
          S
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleMark("spoiler").run()}
          aria-label="Spoiler (caviarde jusqu'au clic)"
          aria-pressed={editor.isActive("spoiler")}
          title="Spoiler : caviarde le passage, un clic le révèle"
          className={`rounded px-2 py-1 text-xs transition-colors hover:bg-panel ${editor.isActive("spoiler") ? "bg-panel text-accent" : "text-ink"}`}
        >
          ▓
        </button>
        <span className="mx-0.5 h-4 w-px bg-edge" />
        <BubbleSelect
          value={currentVisibility}
          options={VISIBILITY_OPTIONS}
          onChange={setVisibilityForSelection}
          aria-label="Visibilité du passage"
        />
      </BubbleMenu>
      <EditorContent editor={editor} />
      {worldSlug && otherEntities && (
        <div className="flex flex-col gap-1.5 rounded-md border border-edge/50 bg-panel-sunken p-2">
          <button
            type="button"
            onClick={() => {
              const next = !showDetect;
              setShowDetect(next);
              if (next) detectLinks();
            }}
            className="self-start text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {showDetect ? "▾" : "▸"} Détecter des liens
          </button>
          {showDetect && (
            <div className="flex flex-col gap-1.5">
              {suggestions.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/5 p-2 text-xs text-ink"
                    >
                      <span>
                        « {s.matchedText} » → {s.targetName}
                      </span>
                      <span className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => applySuggestion(s)} className="font-medium text-accent hover:underline">
                          Lier
                        </button>
                        <button type="button" onClick={() => dismissSuggestion(s)} className="text-ink-muted hover:underline">
                          Ignorer
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                hasDetected && <p className="text-xs italic text-ink-muted">Aucune mention détectée.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
