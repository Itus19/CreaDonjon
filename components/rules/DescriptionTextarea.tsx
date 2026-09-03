"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Champ de description partage par les formulaires "regle maison"
 * (`CreateHomebrewFeatureForm.tsx`, `CreateHomebrewBackgroundForm.tsx`) —
 * retour utilisateur : "le même petit menu contextuel qu'on a fait pour la
 * mise en forme de texte dans les blocs de texte" (`RichTextEditor.tsx`,
 * `BubbleMenu` de Tiptap) plutot qu'un bouton fixe au-dessus du champ.
 *
 * Jamais le meme MOTEUR : le bloc `description` (`zDescriptionBlockData`,
 * rule-blocks/blocks.ts) reste une liste de chaines brutes, pas le modele
 * `SegmentContentNode`/`marks` des blocs d'entite — embarquer Tiptap ici
 * ferait porter par un `<textarea>` un editeur concu pour un tout autre
 * schema de donnees. Ce composant reproduit seulement l'INTERACTION
 * (une bulle flottante apparait a la selection, disparait sinon) sur un
 * `<textarea>` ordinaire : un seul bouton (gras), qui ecrit le meme motif
 * ferme deja reconnu a l'affichage (`Prose.tsx`, `renderMarkdownBoldText` —
 * un paragraphe qui COMMENCE par `**Titre.**` devient un sous-titre en
 * gras, `\n` separe deux paragraphes).
 */
export default function DescriptionTextarea({
  value,
  onChange,
  rows = 4,
  required,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  required?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Position de la derniere souris relachee dans le champ — la bulle flotte
  // pres d'ELLE (comme Tiptap, ancre sur la selection reelle) quand une
  // selection vient d'une souris ; sans ce point (selection au clavier,
  // Maj+Fleches, Ctrl+A...), repli sur un point fixe pres du champ.
  const lastMouseUpRef = useRef<{ x: number; y: number } | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  function updateMenuFromSelection() {
    const el = textareaRef.current;
    if (!el || el.selectionStart === el.selectionEnd) {
      setMenuPos(null);
      return;
    }
    if (lastMouseUpRef.current) {
      setMenuPos({ x: lastMouseUpRef.current.x, y: Math.max(8, lastMouseUpRef.current.y - 44) });
      return;
    }
    const rect = el.getBoundingClientRect();
    setMenuPos({ x: rect.left + 12, y: Math.max(8, rect.top - 4) });
  }

  function wrapSelectionBold() {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    if (!selected) return;
    const next = `${value.slice(0, selectionStart)}**${selected}**${value.slice(selectionEnd)}`;
    onChange(next);
    setMenuPos(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + 2, selectionStart + 2 + selected.length);
    });
  }

  // Ferme la bulle sur un clic hors du champ ET hors de la bulle elle-meme
  // (le bouton n'est pas un descendant du textarea) — jamais sur un clic
  // DANS la bulle, qui doit d'abord laisser son propre bouton s'executer.
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (textareaRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuPos(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={updateMenuFromSelection}
        onMouseUp={(e) => {
          lastMouseUpRef.current = { x: e.clientX, y: e.clientY };
          updateMenuFromSelection();
        }}
        onKeyDown={() => {
          // La position souris n'a plus de sens une fois qu'on retape/navigue
          // au clavier — la prochaine selection retombe sur le repli fixe.
          lastMouseUpRef.current = null;
        }}
        required={required}
        rows={rows}
        className="w-full rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
      />
      {menuPos && (
        <div
          ref={menuRef}
          className="fixed z-[1000] flex items-center gap-0.5 rounded-lg border border-edge-strong bg-panel-raised px-1.5 py-1 shadow-2xl"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            type="button"
            // Empeche le textarea de perdre le focus/sa selection avant que
            // le clic n'atteigne ce bouton (sinon plus rien a mettre en gras).
            onMouseDown={(e) => e.preventDefault()}
            onClick={wrapSelectionBold}
            aria-label="Gras"
            title="Gras — sous-titre de paragraphe (ex. « Formation aux instruments. »)"
            className="rounded px-2 py-1 text-xs font-bold text-ink transition-colors hover:bg-panel"
          >
            G
          </button>
        </div>
      )}
    </div>
  );
}
