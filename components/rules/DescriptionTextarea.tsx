"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Champ de description partage par les formulaires "regle maison"
 * (`CreateHomebrewFeatureForm.tsx`, `CreateHomebrewBackgroundForm.tsx`,
 * `CreateHomebrewWeaponForm.tsx`) — retour utilisateur : "le même petit menu
 * contextuel qu'on a fait pour la mise en forme de texte dans les blocs de
 * texte" (`RichTextEditor.tsx`, `BubbleMenu` de Tiptap), avec les mêmes
 * options (Gras/Italique/Souligné/Barré). Jamais le meme MOTEUR : le bloc
 * `description` (`zDescriptionBlockData`, rule-blocks/blocks.ts) reste une
 * liste de chaines brutes, pas le modele `SegmentContentNode`/`marks` des
 * blocs d'entite — embarquer Tiptap ici ferait porter par un `<textarea>`
 * un editeur concu pour un tout autre schema de donnees. Ce composant
 * reproduit seulement l'INTERACTION (bulle flottante a la selection) et le
 * RESULTAT visuel (quatre marques reconnues a l'affichage, `Prose.tsx`,
 * `renderInline`) sur un `<textarea>` ordinaire.
 *
 * `createPortal` vers `document.body` (meme motif que `AddRuleMenu.tsx`) :
 * ce champ vit typiquement dans une fenetre flottante (`WindowFrame.tsx`,
 * `.window-frame` porte un `backdrop-blur`), et un `backdrop-filter` sur un
 * ancetre cree un nouveau plan de reference pour tout descendant en
 * `position: fixed` (regle CSS) — en sortant le noeud du sous-arbre DOM de
 * la fenetre, `position: fixed` redevient relatif a la fenetre du navigateur.
 *
 * Position ancree sur la selection REELLE, pas sur le dernier clic souris
 * (V2, retour utilisateur — la bulle apparaissait loin du texte quand la
 * selection venait du clavier, Maj+Fleches ou Ctrl+A, jamais suivie) : un
 * `<textarea>` ne donne aucune coordonnee de caractere directement (a la
 * difference d'un `contenteditable`), d'ou `getCaretCoordinates` ci-dessous
 * — le "miroir" est une technique connue (ex. `textarea-caret-position`) :
 * un `<div>` invisible, copie exacte des styles qui affectent le retour a
 * la ligne (police, largeur, marges), rempli du meme texte jusqu'a l'index
 * voulu ; la position du dernier caractere dans CE miroir EST la position
 * du caret dans le vrai champ, quelle que soit la maniere dont la selection
 * a ete faite.
 */

const MIRROR_STYLE_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "letterSpacing",
  "wordSpacing",
  "textIndent",
  "textTransform",
] as const;

function getCaretCoordinates(textarea: HTMLTextAreaElement, index: number): { left: number; top: number; height: number } {
  const mirror = document.createElement("div");
  const style = getComputedStyle(textarea);
  for (const prop of MIRROR_STYLE_PROPS) {
    mirror.style[prop] = style[prop];
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";

  mirror.textContent = textarea.value.slice(0, index);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(index, index + 1) || ".";
  mirror.appendChild(marker);
  mirror.appendChild(document.createTextNode(textarea.value.slice(index + 1)));

  document.body.appendChild(mirror);
  const coords = { left: marker.offsetLeft, top: marker.offsetTop, height: marker.offsetHeight };
  document.body.removeChild(mirror);
  return coords;
}

const MARKS: { marker: string; label: string; ariaLabel: string; className: string }[] = [
  { marker: "**", label: "B", ariaLabel: "Gras", className: "font-bold" },
  { marker: "*", label: "I", ariaLabel: "Italique", className: "italic" },
  { marker: "__", label: "U", ariaLabel: "Souligné", className: "underline" },
  { marker: "~~", label: "S", ariaLabel: "Barré", className: "line-through" },
];

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
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  function updateMenuFromSelection() {
    const el = textareaRef.current;
    if (!el || el.selectionStart === el.selectionEnd) {
      setMenuPos(null);
      return;
    }
    const elRect = el.getBoundingClientRect();
    const caret = getCaretCoordinates(el, el.selectionEnd);
    const x = elRect.left + caret.left - el.scrollLeft;
    const lineTop = elRect.top + caret.top - el.scrollTop;
    const BUBBLE_HEIGHT = 40;
    const y = lineTop - BUBBLE_HEIGHT >= 8 ? lineTop - BUBBLE_HEIGHT : lineTop + caret.height + 6;
    setMenuPos({ x: Math.min(Math.max(8, x), window.innerWidth - 168), y });
  }

  function toggleMark(marker: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    if (selectionStart === selectionEnd) return;
    const selected = value.slice(selectionStart, selectionEnd);
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const alreadyWrapped = before.endsWith(marker) && after.startsWith(marker);

    let next: string;
    let newStart: number;
    let newEnd: number;
    if (alreadyWrapped) {
      next = before.slice(0, before.length - marker.length) + selected + after.slice(marker.length);
      newStart = selectionStart - marker.length;
      newEnd = selectionEnd - marker.length;
    } else {
      next = `${before}${marker}${selected}${marker}${after}`;
      newStart = selectionStart + marker.length;
      newEnd = selectionEnd + marker.length;
    }

    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
      updateMenuFromSelection();
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
        onMouseUp={updateMenuFromSelection}
        onKeyUp={updateMenuFromSelection}
        required={required}
        rows={rows}
        className="w-full rounded-md border border-edge bg-transparent px-2 py-1.5 text-sm text-ink outline-none"
      />
      {menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[1000] flex items-center gap-0.5 rounded-lg border border-edge-strong bg-panel-raised px-1.5 py-1 shadow-2xl"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            {MARKS.map((mark) => (
              <button
                key={mark.marker}
                type="button"
                // Empeche le textarea de perdre le focus/sa selection avant que
                // le clic n'atteigne ce bouton (sinon plus rien a marquer).
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggleMark(mark.marker)}
                aria-label={mark.ariaLabel}
                title={mark.ariaLabel}
                className={`rounded px-2 py-1 text-xs transition-colors hover:bg-panel text-ink ${mark.className}`}
              >
                {mark.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
